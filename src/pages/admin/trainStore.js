/* Setup steps for a train, and how a train from the server maps onto them */

export const STEPS = ['train', 'schedule', 'stations', 'route', 'seats'];

export function nextStep(train) {
  return STEPS.find((s) => !train.done?.[s]) || null;
}

const isObj = (x) => x && typeof x === 'object';

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Does a coach run on this date (yyyy-mm-dd)? Coaches without dates always run. */
export function runsOn(c, iso) {
  return (!c.validFrom || c.validFrom <= iso) && (!c.validTo || c.validTo >= iso);
}

/** "06:40:00" or [6, 40] (however the server sends a time) -> "06:40" for <input type="time"> */
const hhmm = (t) => {
  if (Array.isArray(t)) return `${String(t[0] ?? 0).padStart(2, '0')}:${String(t[1] ?? 0).padStart(2, '0')}`;
  return typeof t === 'string' ? t.slice(0, 5) : '';
};

/** Train as returned by GET /admin/trains -> the shape the setup steps use */
export function fromServer(t) {
  const stops = (t.stations || []).filter(isObj);
  const coaches = (t.coaches || []).filter(isObj);
  const days = (isObj(t.schedule) && t.schedule.runningWeeks) || [];
  return {
    trainNumber: t.trainNumber,
    trainName: t.trainName,
    sourceStation: t.sourceStation,
    destinationStation: t.destinationStation,
    train_type: t.train_type,
    days,
    stops: stops.map((s) => ({
      stationName: s.stationName,
      stationCode: s.stationCode,
      arrivalTime: hhmm(s.arrivalTime),
      departureTime: hhmm(s.departureTime),
      km: Number(s.km) || 0,
    })),
    basePrice: isObj(t.route) ? t.route.price : undefined,
    coaches: coaches.map(({ coachNumber, coachType, numberOfSeats, validFrom, validTo }) => ({
      coachNumber,
      coachType,
      numberOfSeats,
      validFrom: validFrom || null,
      validTo: validTo || null,
    })),
    // seats on the coaches running today
    totalSeats: coaches.filter((c) => runsOn(c, todayIso())).reduce((sum, c) => sum + (c.numberOfSeats || 0), 0),
    done: {
      train: true,
      schedule: days.length > 0,
      stations: stops.length > 0,
      route: isObj(t.route),
      seats: coaches.length > 0,
    },
  };
}
