/* Helpers for working out a train's journey between two stations */
import { SEAT_TYPES } from './api.js';
import { formatTime, minutesOf } from './components/ui.jsx';

const matches = (name, query) => name && query && name.toLowerCase().includes(query.toLowerCase());

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Everything the results page needs about one train for one search:
 * boarding/alighting stops, times, day offsets, distance and classes.
 */
export function describeJourney(train, from, to, isoDate, fromStop, toStop) {
  const stations = (train.stations || []).filter((s) => s && typeof s === 'object');
  // The backend tells us which stops match (by code, city or name); fall back to matching names
  const si = Number.isInteger(fromStop) ? fromStop : stations.findIndex((s) => matches(s.stationName, from));
  const ei = Number.isInteger(toStop) ? toStop : stations.findIndex((s, i) => i > si && matches(s.stationName, to));
  const board = stations[si];
  const alight = stations[ei];

  // Walk the stops; every time the clock goes backwards the train has crossed midnight
  const dayOf = [];
  let day = 0;
  let prev = null;
  stations.forEach((s, i) => {
    const arr = minutesOf(s.arrivalTime);
    const dep = minutesOf(s.departureTime);
    if (prev != null && arr != null && arr < prev) day += 1;
    dayOf[i] = day;
    if (arr != null) prev = arr;
    if (dep != null) {
      if (prev != null && dep < prev) day += 1;
      prev = dep;
    }
  });

  const depMin = minutesOf(board?.departureTime);
  const arrMin = minutesOf(alight?.arrivalTime);
  const extraDays = si >= 0 && ei > si ? dayOf[ei] - dayOf[si] : 0;
  const durationMin = depMin != null && arrMin != null ? arrMin - depMin + extraDays * 1440 : null;

  const start = new Date(isoDate + 'T00:00');
  const arrDate = new Date(start);
  arrDate.setDate(arrDate.getDate() + Math.max(extraDays, 0));

  const distance = si >= 0 && ei > si ? stations.slice(si + 1, ei + 1).reduce((sum, s) => sum + (Number(s.km) || 0), 0) : null;

  const runningDays = (train.schedule && typeof train.schedule === 'object' ? train.schedule.runningWeeks : null) || [];
  const runs = DAY_ORDER.map((d) => runningDays.some((r) => String(r).toLowerCase() === d));

  return {
    stations,
    si,
    ei,
    board,
    alight,
    depTime: formatTime(board?.departureTime),
    arrTime: formatTime(alight?.arrivalTime),
    depMin,
    arrMin,
    durationMin,
    depDate: start,
    arrDate,
    distance,
    runs,
    knowsRunningDays: runningDays.length > 0,
    classes: classesOf(train),
  };
}

/** The classes this train carries, from its coaches */
export function classesOf(train) {
  const coaches = (train.coaches || []).filter((c) => c && typeof c === 'object');
  return SEAT_TYPES.map((type) => {
    const ofType = coaches.filter((c) => c.coachType === type.id);
    if (!ofType.length) return null;
    return { ...type, coaches: ofType.length };
  }).filter(Boolean);
}

export function formatDay(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function durationLabel(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const TIME_SLOTS = [
  { id: 'early', label: '00:00 – 06:00', from: 0, to: 360 },
  { id: 'morning', label: '06:00 – 12:00', from: 360, to: 720 },
  { id: 'afternoon', label: '12:00 – 18:00', from: 720, to: 1080 },
  { id: 'night', label: '18:00 – 24:00', from: 1080, to: 1440 },
];
