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
  selectClass: (token, { trainNo, start, end, seatType, date }) =>
    call(
      'GET',
      `/customer/select_class/${trainNo}/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
      { token, query: { seat_type: seatType, date: toBackendDate(date) } }
    ),
  /** Live station search: code, name or city. No log-in needed. */
  stations: (q) => call('GET', '/customer/stations', { query: { q }, quiet: true }),
  /** Trains between two places; from / to are a station code, city or name */
  trains: (token, { from, to, date }) =>
    call('GET', '/customer/trains', { token, query: { from, to, date: toBackendDate(date) } }),
  /** passengers: [{ name, age, gender, berthPreference }] */
  book: (token, { trainNo, seatType, date, from, to, passengers }) =>
    call('POST', `/customer/booking/${trainNo}`, {
      token,
      query: { seat_type: seatType, book_date: toBackendDate(date), from, to },
      json: passengers,
    }),
  pnr: (token, pnr) => call('GET', `/customer/pnr/${pnr}`, { token }),
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
  trains: (token) => call('GET', '/admin/trains', { token }),
  /** station: { code, name, city, state } */
  addStation: (token, station) => call('POST', '/admin/stations', { token, json: station }),
  /** Estimated km between consecutive stops: [null, 81, 223, …]; null where unknown */
  distances: (token, codes) => call('GET', '/admin/distances', { token, query: { codes: codes.join(',') }, quiet: true }),
  /** composition: { SLEEPER_CLASS: 10, AC3_TIER: 4, ... } */
  addCoaches: (token, trainNo, composition) =>
    call('POST', `/admin/addCoaches/${trainNo}`, { token, json: composition }),
  deleteTrain: (token, trainNo) => call('DELETE', `/admin/delete/${trainNo}`, { token }),
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
