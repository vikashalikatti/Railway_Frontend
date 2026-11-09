import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CoachMap from '../../components/CoachMap.jsx';
import { BERTH_LABELS, customerApi, MEALS, quotaOf, SEAT_TYPES } from '../../api.js';
import { rupees } from '../../components/ui.jsx';

const STATUS = {
  CONFIRMED: { label: 'Confirmed', bg: 'success', icon: 'bi-check-circle' },
  PARTIALLY_CONFIRMED: { label: 'Partly confirmed', bg: 'warning', icon: 'bi-hourglass-split' },
  WAITLISTED: { label: 'Waitlisted', bg: 'warning', icon: 'bi-hourglass-split' },
  CANCELLED: { label: 'Cancelled', bg: 'danger', icon: 'bi-x-circle' },
};

/** "CNF S2/33/Lower", "TQWL 3", "Not confirmed at charting" or "Cancelled" */
export function passengerStatus(p, quota = 'GN') {
  const wl = quotaOf(quota).wl || 'WL';
  if (p.status === 'CNF') return `CNF ${p.coachNumber}/${p.seatNumber}/${BERTH_LABELS[p.berthType] || p.berthType}`;
  if (p.status === 'WL') return `${wl} ${p.currentWlPosition ?? p.wlNumber}`;
  if (p.status === 'NB') return p.age < 5 ? 'Infant, no berth (free)' : 'Child, no berth';
  if (p.cancelReason === 'TRAIN') return 'Train cancelled';
  if (p.cancelReason === 'CHART') return 'Not confirmed at charting';
  return 'Cancelled';
}

/**
 * A PNR as a ticket: journey on top, passengers below.
 * `actions(p)` can render a cancel button per passenger; `footer` goes underneath.
 */
export default function Ticket({ booking: b, actions, footer }) {
  const cls = SEAT_TYPES.find((t) => t.id === b.seatType);
  const st = STATUS[b.status] || { label: b.status, bg: 'secondary', icon: 'bi-info-circle' };
  const date = new Date(b.journeyDate + 'T00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const active = b.passengers.filter((p) => p.status !== 'CAN').length;
  const quota = b.quota || 'GN';
  const wl = quotaOf(quota).wl || 'WL';
  const chartDone = b.chartStatus === 'PREPARED' || b.chartStatus === 'FINAL';
  const [showCoach, setShowCoach] = useState(false);
  // Running status for journeys from yesterday on (cancelled, rescheduled, where the train is)
  const [running, setRunning] = useState(null);
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    if (b.journeyDate < d.toISOString().slice(0, 10)) return;
    customerApi
      .running(b.trainNumber, b.journeyDate)
      .then((res) => setRunning(res.data2))
      .catch(() => {});
  }, [b.trainNumber, b.journeyDate]);
  const runLine = (() => {
    if (!running) return null;
    if (running.cancelled) return { tone: 'danger', text: `Train cancelled on this date${running.cancelReason ? `: ${running.cancelReason}` : ''}` };
    const where = running.currentStop != null ? running.stops[running.currentStop] : null;
    const late = running.delayMinutes > 0 ? `Running ${running.delayMinutes} min late` : 'On time';
    const board = running.stops.find((s) => s.station === b.fromStation);
    const parts = [late];
    if (where) parts.push(`${running.departed ? 'left' : 'at'} ${where.station}`);
    if (running.delayMinutes > 0 && board?.expectedDeparture) parts.push(`expected to leave ${b.fromStation} at ${board.expectedDeparture}`);
    if (!where && running.delayMinutes === 0) return null;
    return { tone: running.delayMinutes > 0 ? 'warning' : 'success', text: parts.join(', ') };
  })();
  // Confirmed passengers per coach, for "show in coach"
  const byCoach = {};
  b.passengers
    .filter((p) => p.status === 'CNF' && p.coachNumber && p.seatNumber)
    .forEach((p) => {
      (byCoach[p.coachNumber] = byCoach[p.coachNumber] || {})[p.seatNumber] = p.name;
    });
  const coachNumbers = Object.keys(byCoach);

  return (
    <Card as="article" className="ticket-card shadow-sm overflow-hidden">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <div className="d-flex align-items-baseline gap-2">
          <span className="small text-white-50">PNR</span>
          <span className="pnr">{b.bookingId}</span>
        </div>
        <Badge pill bg={st.bg} text={st.bg === 'warning' ? 'dark' : undefined} className="px-3 py-2">
          <i className={`bi ${st.icon} me-1`} aria-hidden="true" />
          {st.label}
        </Badge>
      </Card.Header>
      <Card.Body className="journey">
        <div className="row g-3">
          <div className="col-md-5">
            <div className="fw-bold text-dark">
              {b.trainName} ({b.trainNumber})
            </div>
            <div className="small text-secondary">
              {b.fromStation} <i className="bi bi-arrow-right mx-1" aria-hidden="true" />
              {b.toStation}
            </div>
          </div>
          <div className="col-7 col-md-4">
            <div className="fw-bold text-dark">{date}</div>
            <div className="small text-secondary">
              {cls ? `${cls.label} (${cls.short})` : b.seatType}, {Math.round(b.distanceKm)} km
            </div>
            <div className="d-flex flex-wrap gap-1 mt-1">
              {quota !== 'GN' && <span className="badge text-bg-warning">{quotaOf(quota).label} quota</span>}
              {chartDone && (
                <Link to={`/chart?train=${b.trainNumber}&date=${b.journeyDate}`} className="badge text-bg-secondary text-decoration-none">
                  <i className="bi bi-clipboard-check me-1" aria-hidden="true" />
                  Chart prepared: view vacancy
                </Link>
              )}
            </div>
          </div>
          <div className="col-5 col-md-3 text-end">
            <div className="fw-bold fs-5 text-dark">{rupees(b.totalFare)}</div>
            <div className="small text-secondary">
              {active === b.passengers.length ? `${b.passengers.length} ${b.passengers.length === 1 ? "passenger" : "passengers"}` : `${active} of ${b.passengers.length} active`}
            </div>
          </div>
        </div>
      </Card.Body>
      <Table responsive className="mb-0 align-middle">
        <thead className="table-light">
          <tr>
            <th scope="col" className="ps-3">Passenger</th>
            <th scope="col">Age</th>
            <th scope="col">Status</th>
            {actions && (
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {b.passengers.map((p) => (
            <tr key={p.id} className={p.status === 'CAN' ? 'is-cancelled' : ''}>
              <td className="ps-3">
                {p.name}
                <div className="small text-secondary">{p.gender}</div>
              </td>
              <td>{p.age}</td>
              <td>
                <span className={`pax-status ps-${p.status.toLowerCase()}`}>{passengerStatus(p, quota)}</span>
                {(p.meal && p.meal !== 'NONE') || p.bedroll ? (
                  <div className="small text-secondary">
                    {[p.meal && p.meal !== 'NONE' ? `${MEALS.find((m) => m.id === p.meal)?.label || p.meal} meal` : null, p.bedroll ? 'bedroll' : null]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                ) : null}
                {p.status === 'WL' && p.currentWlPosition != null && p.wlNumber !== p.currentWlPosition && (
                  <div className="small text-secondary">
                    Booked at {wl} {p.wlNumber}
                  </div>
                )}
                {p.status === 'CNF' && p.wlNumber != null && <div className="small text-secondary">Booked at {wl} {p.wlNumber}</div>}
                {p.status === 'CNF' && p.nearWomen && (
                  <div className="small text-secondary">
                    <i className="bi bi-people me-1" aria-hidden="true" />
                    Seated in a bay with other women
                  </div>
                )}
                {p.status === 'CNF' && p.companionNote && (
                  <div className="small companion-note">
                    <i className="bi bi-person-heart me-1" aria-hidden="true" />
                    {p.companionNote}
                  </div>
                )}
                {p.status === 'CNF' && !p.companionNote && p.needsAssistance && (
                  <div className="small text-secondary">Boarding help asked for. No helper on this coach yet; we keep looking until the chart.</div>
                )}
                {p.status === 'WL' && (p.needsAssistance || p.helper) && (
                  <div className="small text-secondary">{p.needsAssistance ? 'Boarding help' : 'Helper'}: matched once confirmed</div>
                )}
                {p.status === 'CNF' && p.wlNumber != null && <div className="small text-secondary">Booked at {wl} {p.wlNumber}</div>}
              </td>
              {actions && <td className="text-end pe-3">{actions(p)}</td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {(runLine || b.refundAmount > 0) && (
        <div className="border-top px-3 py-2 small d-flex flex-wrap gap-3">
          {runLine && (
            <span className={`text-${runLine.tone === 'warning' ? 'warning-emphasis' : runLine.tone}`}>
              <i className="bi bi-broadcast me-1" aria-hidden="true" />
              {runLine.text}
            </span>
          )}
          {b.refundAmount > 0 && (
            <span className="fw-semibold">
              <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
              Refund {rupees(b.refundAmount)}
            </span>
          )}
        </div>
      )}
      {coachNumbers.length > 0 && (
        <div className="border-top px-3 py-2">
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setShowCoach((v) => !v)} aria-expanded={showCoach}>
            <i className={`bi ${showCoach ? 'bi-chevron-up' : 'bi-train-front'} me-1`} aria-hidden="true" />
            {showCoach ? 'Hide coach layout' : `Show where you sit in ${coachNumbers.join(', ')}`}
          </button>
          {showCoach && (
            <div className="coach-grid mt-2 mb-2">
              {coachNumbers.map((c) => (
                <CoachMap
                  key={c}
                  coachNumber={c}
                  seatType={b.seatType}
                  seats={cls?.seats || 72}
                  caption="Your berths are highlighted"
                  tile={(n) => (byCoach[c][n] ? { state: 'mine', title: byCoach[c][n] } : { state: 'plain' })}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {footer}
    </Card>
  );
}
