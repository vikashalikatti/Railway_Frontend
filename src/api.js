/*
 * Client for the Spring Boot backend.
 *
 * Backend quirks handled here:
 *  - The JWT goes in a request header literally named "Bearer".
 *  - Every response is a ResponseStructure { status, message, data, data2 }.
 *    The HTTP status isn't reliable (customer login returns 400 even on success),
 *    so success is decided by the "status" field inside the body.
 *  - Dates are expected as M/d/yyyy.
 */

// Empty = same origin (Vite dev proxy). Set VITE_API_BASE to call another host directly.
const BASE = import.meta.env.VITE_API_BASE || '';

const SUCCESS = [200, 201, 202];

/* Number of requests in flight, so the page can show a loading bar */
let inFlight = 0;
const listeners = new Set();
export function onLoadingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setInFlight(n) {
  inFlight = n;
  listeners.forEach((fn) => fn(inFlight > 0));
}

/** Messages from the backend's catch-all exception handler: they describe a bug, not something the user did */
const INTERNAL_MESSAGES = ['Object is NULL', 'There is an Arithmetic exception', 'There is an NoZero exception', 'Constraint Violation'];

export const GENERIC_ERROR = 'Please try again in a moment. If it keeps happening, contact support.';

export class ApiError extends Error {
  /**
   * @param unexpected true when the failure isn't the user's doing (server error, network, bug).
   *                   The UI then shows "Something went wrong" instead of the raw text.
   */
  constructor(message, status, body, unexpected = false) {
    super(message);
    this.status = status;
    this.body = body;
    this.unexpected = unexpected;
  }
}

/**
 * params: sent as a form body (application/x-www-form-urlencoded), not in the URL.
 * Use it for passwords and OTPs: URLs end up in server logs, proxies and browser history.
 */
async function call(method, path, { query, params, json, form, token, quiet = false } = {}) {
  let url = BASE + path;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += '?' + s;
  }

  const headers = {};
  if (token) headers['Bearer'] = token;

  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // FormData — the browser sets the multipart boundary
  } else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    const ps = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) ps.append(k, v);
    });
    body = ps;
  }

  let res;
  let text;
  if (!quiet) setInFlight(inFlight + 1); // live search shouldn't flash the page loading bar
  try {
    // credentials: 'omit' — the app never uses cookies, so none are sent along
    res = await fetch(url, { method, headers, body, credentials: 'omit', cache: 'no-store' });
    text = await res.text();
  } catch {
    throw new ApiError('We couldn’t reach the server. Check your internet connection and that the backend is running.', 0, null, true);
  } finally {
    if (!quiet) setInFlight(inFlight - 1);
  }

  let data = null;
  let notJson = false;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      notJson = true; // e.g. an HTML error page from a proxy or server
    }
  }

  const status = data && typeof data.status === 'number' ? data.status : res.status;
  // The backend only uses 200, 201 and 202 for success. Anything else is a refusal,
  // including 208 Already Reported ("Admin Cannot More than one").
  if (!SUCCESS.includes(status)) {
    let message = data && typeof data.message === 'string' ? data.message.trim() : '';
    // Spring Security's wrong-password error arrives through the catch-all handler as data: "Bad credentials"
    if (!message && typeof data?.data === 'string' && /bad credentials/i.test(data.data)) message = 'Bad credentials';
    // Server errors, non-JSON replies, and the catch-all handler (empty message, raw text in "data")
    // are bugs or outages: never show their raw text to the user.
    // Spring's CORS check answers in plain text: say what to fix instead of "try again"
    if (notJson && status === 403 && /cors/i.test(text)) {
      throw new ApiError(
        'The server refused requests from this address. Open the app from the address Vite prints, or add this address to CORS_ORIGINS.',
        403,
        null,
        false
      );
    }
    const unexpected =
      notJson || status >= 500 || !message || INTERNAL_MESSAGES.includes(message) || (status === 400 && !message && data?.data);
    throw new ApiError(unexpected ? GENERIC_ERROR : message, status, data, unexpected);
  }
  return data ?? { status, message: '', data: null, data2: null };
}

/** yyyy-mm-dd (from <input type="date">) → M/d/yyyy for the backend */
export function toBackendDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

export const customerApi = {
  signup: (formData) => call('POST', '/customer/signup', { form: formData }),
  // The backend names this parameter "name" but looks the customer up by email
  login: (email, password) => call('POST', '/customer/login', { params: { name: email, password } }),
  verifyOtp: (email, otp) => call('POST', '/customer/verify_otp', { params: { email, otp } }),
  resendOtp: (email) => call('POST', '/customer/resend_otp', { params: { email } }),
  forgotPassword: (email) => call('POST', '/customer/forgot_passowrd', { params: { email } }),
  submitForgotOtp: (email, otp) =>
    call('POST', `/customer/forgot-otp/${encodeURIComponent(email)}`, { params: { otp } }),
  /** token: the short-lived reset token from submitForgotOtp (not a log-in token) */
  resetPassword: (email, password, token) =>
    call('POST', '/customer/reset-password', { params: { email, password }, token }),
  /** Ends this session on the server; everywhere = every device */
  logout: (token, everywhere = false) => call('POST', '/customer/logout', { params: { everywhere }, token, quiet: true }),
  search: (token, { start, end, email, date }) =>
    call('GET', '/customer/searchStation', {
      token,
      query: { start, end, email, date: toBackendDate(date) },
    }),
  selectClass: (token, { trainNo, start, end, seatType, date, quota = 'GN' }) =>
    call(
      'GET',
      `/customer/select_class/${trainNo}/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
      { token, query: { seat_type: seatType, date: toBackendDate(date), quota } }
    ),
  /** Live station search: code, name or city. No log-in needed. */
  stations: (q) => call('GET', '/customer/stations', { query: { q }, quiet: true }),
  /** Trains between two places; from / to are a station code, city or name */
  trains: (token, { from, to, date }) =>
    call('GET', '/customer/trains', { token, query: { from, to, date: toBackendDate(date) } }),
  /** passengers: [{ name, age, gender, berthPreference, … }]; paymentId: a PAID test payment */
  book: (token, { trainNo, seatType, date, from, to, quota = 'GN', passengers, paymentId, vikalp = false }) =>
    call('POST', `/customer/booking/${trainNo}`, {
      token,
      query: { seat_type: seatType, book_date: toBackendDate(date), from, to, quota, payment_id: paymentId, vikalp },
      json: passengers,
    }),
  /** Test payment gateway. body: { amount, method: CARD|UPI|NETBANKING, cardNumber, expiry, cvv, nameOnCard, upiId, bank } */
  startPayment: (token, body) => call('POST', '/customer/payments', { token, json: body }),
  /** { otp } for cards, { approve: true|false } for UPI and net banking */
  confirmPayment: (token, id, body) => call('POST', `/customer/payments/${encodeURIComponent(id)}/confirm`, { token, json: body }),
  payments: (token) => call('GET', '/customer/payments', { token, quiet: true }),
  banks: () => call('GET', '/customer/payments/banks', { quiet: true }),
  /** What cancelling these passengers (all when empty) would refund; changes nothing */
  cancelPreview: (token, pnr, passengerIds = []) => call('POST', `/customer/cancel_preview/${pnr}`, { token, json: passengerIds, quiet: true }),
  /** Signed code for an e-ticket's QR */
  ticketCode: (token, pnr) => call('GET', `/customer/ticket-code/${pnr}`, { token, quiet: true }),
  /** Public: what a ticket checker sees */
  verifyTicket: (code) => call('GET', '/customer/verify-ticket', { query: { code } }),
  /** Public timetable of one train */
  timetable: (trainNo) => call('GET', `/customer/timetable/${trainNo}`),
  /** Public: trains by number or name (2+ characters) */
  findTrains: (q) => call('GET', '/customer/train-search', { query: { q }, quiet: true }),
  pnr: (token, pnr) => call('GET', `/customer/pnr/${pnr}`, { token }),
  /** PNR status without logging in (no names) */
  publicPnr: (pnr) => call('GET', `/customer/pnr-status/${pnr}`),
  /** Running status of a train on a date (yyyy-mm-dd): cancelled, delay, where it is. Public. */
  running: (trainNo, date) => call('GET', `/customer/running/${trainNo}`, { query: { date }, quiet: true }),
  /** Two trains with one change */
  connections: (token, { from, to, date }) =>
    call('GET', '/customer/connections', { token, query: { from, to, date: toBackendDate(date) } }),
  savedPassengers: (token) => call('GET', '/customer/saved_passengers', { token, quiet: true }),
  savePassenger: (token, p) => call('POST', '/customer/saved_passengers', { token, json: p }),
  deleteSavedPassenger: (token, id) => call('DELETE', `/customer/saved_passengers/${id}`, { token }),
  /** Chart & vacancy after the chart is prepared: berths only, no names. Public. date is yyyy-mm-dd. */
  chart: (trainNo, date) => call('GET', `/customer/chart/${trainNo}`, { query: { date } }),
  myBookings: (token) => call('GET', '/customer/my_bookings', { token }),
  /** passengerIds: cancel only these; empty or missing cancels the whole booking */
  cancel: (token, pnr, passengerIds = []) => call('POST', `/customer/cancel/${pnr}`, { token, json: passengerIds }),
};

export const adminApi = {
  create: (admin) => call('POST', '/admin/create', { json: admin }),
  login: (name, password) => call('POST', '/admin/login', { params: { name, password } }),
  logout: (token, everywhere = false) => call('POST', '/admin/logout', { params: { everywhere }, token, quiet: true }),
  addTrain: (token, train) => {
    const fd = new FormData();
    Object.entries(train).forEach(([k, v]) => fd.append(k, v));
    return call('POST', '/admin/addtrain', { token, form: fd });
  },
  addSchedule: (token, trainNo, days) => {
    const fd = new FormData();
    days.forEach((d) => fd.append('runningWeeks', d));
    return call('POST', '/admin/schedule', { token, form: fd, query: { train_No: trainNo } });
  },
  addStations: (token, trainNo, stations) =>
    call('POST', `/admin/addstations/${trainNo}`, { token, json: stations }),
  addRoute: (token, trainNo, route) => call('POST', `/admin/addRoute/${trainNo}`, { token, json: route }),
  /** Trains by number, up to `limit`, filtered by q (number, name, first or last station). data = total matching. */
  trains: (token, q = '', limit = 50, quiet = false) => call('GET', '/admin/trains', { token, query: { q, limit }, quiet }),
  /** One train with its stops, fare and coaches */
  train: (token, trainNo) => call('GET', `/admin/trains/${trainNo}`, { token }),
  /** Bulk import: what the bundled Indian Railways list holds */
  importSummary: (token) => call('GET', '/admin/import/bundled', { token }),
  /** options: { coaches: { SL: 4, … }, baseFare, addCoaches, onlyStations, limit } */
  importBundled: (token, options) => call('POST', '/admin/import/bundled', { token, json: options }),
  importUpload: (token, file, options) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('options', JSON.stringify(options));
    return call('POST', '/admin/import/upload', { token, form: fd });
  },
  importStatus: (token) => call('GET', '/admin/import/status', { token, quiet: true }),
  /** station: { code, name, city, state } */
  addStation: (token, station) => call('POST', '/admin/stations', { token, json: station }),
  /** Quota split per class: [{ seatType, tatkalPct, premiumPct, ladiesPct, seniorPct, saved, seats, seatsByQuota }] */
  /** Extra coaches from a date, for good or until `to` (rush days): { seatType, count, from, to } */
  addCoachesFrom: (token, trainNo, body) => call('POST', `/admin/coaches/${trainNo}/add`, { token, json: body }),
  /** Take coaches off from a date on: { coachNumbers: ['S9'], from } */
  removeCoachesFrom: (token, trainNo, body) => call('POST', `/admin/coaches/${trainNo}/remove`, { token, json: body }),
  cancelRun: (token, trainNo, body) => call('POST', `/admin/runs/${trainNo}/cancel`, { token, json: body }),
  rescheduleRun: (token, trainNo, body) => call('POST', `/admin/runs/${trainNo}/reschedule`, { token, json: body }),
  runPosition: (token, trainNo, body) => call('POST', `/admin/runs/${trainNo}/position`, { token, json: body }),
  report: (token, from, to) => call('GET', '/admin/reports', { token, query: { from, to } }),
  /** Reservation chart with every passenger; any time. date is yyyy-mm-dd. */
  chart: (token, trainNo, date) => call('GET', `/admin/chart/${trainNo}`, { token, query: { date } }),
  quotas: (token, trainNo) => call('GET', `/admin/quotas/${trainNo}`, { token }),
  /** shares: { SLEEPER_CLASS: { tatkalPct, premiumPct, ladiesPct, seniorPct }, … } */
  saveQuotas: (token, trainNo, shares) => call('POST', `/admin/quotas/${trainNo}`, { token, json: shares }),
  /** Estimated km between consecutive stops: [null, 81, 223, …]; null where unknown */
  distances: (token, codes) => call('GET', '/admin/distances', { token, query: { codes: codes.join(',') }, quiet: true }),
  /** composition: { SLEEPER_CLASS: 10, AC3_TIER: 4, ... } */
  addCoaches: (token, trainNo, composition) =>
    call('POST', `/admin/addCoaches/${trainNo}`, { token, json: composition }),
  deleteTrain: (token, trainNo) => call('DELETE', `/admin/delete/${trainNo}`, { token }),
  customers: (token, q = '', limit = 50) => call('GET', '/admin/customers', { token, query: { q, limit }, quiet: true }),
  customerBookings: (token, id) => call('GET', `/admin/customers/${id}/bookings`, { token }),
  blockCustomer: (token, id, reason) => call('POST', `/admin/customers/${id}/block`, { token, json: { reason } }),
  unblockCustomer: (token, id) => call('POST', `/admin/customers/${id}/unblock`, { token }),
  audit: (token, q = '', limit = 200) => call('GET', '/admin/audit', { token, query: { q, limit }, quiet: true }),
};

export const BERTH_LABELS = {
  LOWER: 'Lower',
  MIDDLE: 'Middle',
  UPPER: 'Upper',
  SIDE_LOWER: 'Side lower',
  SIDE_MIDDLE: 'Side middle',
  SIDE_UPPER: 'Side upper',
  WINDOW: 'Window',
  MIDDLE_SEAT: 'Middle',
  AISLE: 'Aisle',
};

/** Reserved classes, cheapest first. seats/prefix match the backend's CoachLayout. */
export const SEAT_TYPES = [
  { id: 'SECOND_CLASS', label: 'Second sitting', short: '2S', ac: false, seats: 108, prefix: 'D', berths: false, layout: '3+3 rows' },
  { id: 'SLEEPER_CLASS', label: 'Sleeper', short: 'SL', ac: false, seats: 72, prefix: 'S', berths: true, layout: '8 per bay' },
  { id: 'AC_CHAIR_CAR', label: 'AC chair car', short: 'CC', ac: true, seats: 78, prefix: 'C', berths: false, layout: '3+2 rows' },
  { id: 'AC3_ECONOMY', label: 'AC 3 economy', short: '3E', ac: true, seats: 81, prefix: 'M', berths: true, layout: '9 per bay, 3 side berths' },
  { id: 'AC3_TIER', label: 'AC 3 tier', short: '3A', ac: true, seats: 72, prefix: 'B', berths: true, layout: '8 per bay' },
  { id: 'AC2_TIER', label: 'AC 2 tier', short: '2A', ac: true, seats: 48, prefix: 'A', berths: true, layout: '6 per bay' },
  { id: 'EXECUTIVE_CHAIR_CAR', label: 'Executive chair car', short: 'EC', ac: true, seats: 56, prefix: 'E', berths: false, layout: '2+2 rows' },
  { id: 'AC1_TIER', label: 'AC first class', short: '1A', ac: true, seats: 18, prefix: 'H', berths: true, layout: 'cabins' },
];

/**
 * Reservation quotas (same rules as the backend's Quota.java).
 * wl: the waitlist label prefix, or null when the quota has no waitlist.
 */
export const QUOTAS = [
  { id: 'GN', label: 'General', wl: 'WL', max: 6, hint: '' },
  { id: 'TQ', label: 'Tatkal', wl: 'TQWL', max: 4, hint: 'Opens the day before the journey: 10:00 for AC classes, 11:00 for Sleeper and second sitting. Extra Tatkal charge.' },
  { id: 'PT', label: 'Premium Tatkal', wl: null, max: 4, hint: 'Opens with Tatkal. The fare rises as seats sell, and there is no waitlist.' },
  { id: 'LD', label: 'Ladies', wl: null, max: 6, hint: 'For women, and children under 12 travelling with them. No waitlist.' },
  { id: 'SS', label: 'Senior citizen', wl: null, max: 2, hint: 'Lower berths for men aged 60+ and women aged 45+, up to 2 per booking. No waitlist.' },
  { id: 'PH', label: 'Divyangjan', wl: null, max: 2, hint: 'For a passenger with a disability concession card, and one escort. Lower berths. No waitlist.' },
];

/** Classes with RAC (side-lower berths shared by two RAC passengers) — same as the backend's RacRules */
export const RAC_CLASSES = ['SLEEPER_CLASS', 'AC3_TIER', 'AC3_ECONOMY', 'AC2_TIER'];

export const quotaOf = (id) => QUOTAS.find((q) => q.id === id) || QUOTAS[0];

const BERTH_CLASSES = ['SLEEPER_CLASS', 'AC3_TIER', 'AC2_TIER', 'AC1_TIER', 'AC3_ECONOMY'];

/** Does this class sell seats in this quota? */
export function quotaOffered(quotaId, seatTypeId) {
  if ((quotaId === 'TQ' || quotaId === 'PT') && seatTypeId === 'AC1_TIER') return false; // no Tatkal in 1A
  if (quotaId === 'SS') return BERTH_CLASSES.includes(seatTypeId); // lower berths only
  return true;
}

/** Why these passengers can't book in this quota, or '' — mirrors Quota.eligibility on the server */
export function quotaProblem(quotaId, passengers) {
  const q = quotaOf(quotaId);
  if (passengers.length > q.max) return `${q.label} allows up to ${q.max} passengers per booking.`;
  const ok = passengers.filter((p) => p.age !== '' && p.gender);
  if (quotaId === 'LD') {
    if (ok.some((p) => p.gender !== 'Female' && Number(p.age) >= 12))
      return 'Ladies quota is for women, and children under 12 travelling with them.';
    if (ok.length === passengers.length && !ok.some((p) => p.gender === 'Female' && Number(p.age) >= 12))
      return 'Ladies quota needs at least one woman aged 12 or over.';
  }
  if (quotaId === 'SS' && ok.some((p) => (p.gender === 'Female' ? Number(p.age) < 45 : Number(p.age) < 60)))
    return 'Senior citizen quota is for men aged 60+ and women aged 45+.';
  if (quotaId === 'PH' && ok.length === passengers.length && !passengers.some((p) => p.divyang))
    return 'Divyangjan quota needs a passenger with a disability concession card: tick “Divyangjan” for them.';
  return '';
}

/** Meals and bedroll (same as the backend's TravelRules) */
export const MEALS = [
  { id: 'NONE', label: 'No meal', price: 0 },
  { id: 'VEG', label: 'Veg', price: 120 },
  { id: 'NON_VEG', label: 'Non-veg', price: 150 },
  { id: 'JAIN', label: 'Jain', price: 120 },
];
export const BEDROLL_PRICE = 150;
export const bedrollIncluded = (type) => ['AC1_TIER', 'AC2_TIER', 'AC3_TIER', 'AC3_ECONOMY'].includes(type);
export const bedrollOffered = (type) => type === 'SLEEPER_CLASS';
export const isInfant = (age) => age !== '' && Number(age) < 5;
export const isChild = (age) => age !== '' && Number(age) >= 5 && Number(age) < 12;
/** Ticket fare for one passenger before extras: infants free, 5-11 without a berth half */
export function ticketFare(p, fullFare) {
  if (isInfant(p.age)) return 0;
  if (isChild(p.age) && p.noBerth) return Math.round(fullFare / 2);
  return fullFare;
}
/** Boarding help and helpers (same as the backend's CompanionRules) */
export const canAskForHelp = (age, withBerth) => age !== '' && Number(age) >= 60 && withBerth === 1;
export const canHelp = (age) => age !== '' && Number(age) >= 18 && Number(age) < 60;

export function extrasFare(p, type) {
  const meal = MEALS.find((m) => m.id === (p.meal || 'NONE'));
  return (meal ? meal.price : 0) + (p.bedroll && bedrollOffered(type) ? BEDROLL_PRICE : 0);
}
