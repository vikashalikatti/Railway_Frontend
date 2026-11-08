import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { BERTH_LABELS, SEAT_TYPES } from '../../api.js';
import { rupees } from '../../components/ui.jsx';

const STATUS = {
  CONFIRMED: { label: 'Confirmed', bg: 'success', icon: 'bi-check-circle' },
  PARTIALLY_CONFIRMED: { label: 'Partly confirmed', bg: 'warning', icon: 'bi-hourglass-split' },
  WAITLISTED: { label: 'Waitlisted', bg: 'warning', icon: 'bi-hourglass-split' },
  CANCELLED: { label: 'Cancelled', bg: 'danger', icon: 'bi-x-circle' },
};

export function passengerStatus(p) {
  if (p.status === 'CNF') return `CNF ${p.coachNumber}/${p.seatNumber}/${BERTH_LABELS[p.berthType] || p.berthType}`;
  if (p.status === 'WL') return `WL ${p.currentWlPosition ?? p.wlNumber}`;
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
          </div>
          <div className="col-5 col-md-3 text-end">
            <div className="fw-bold fs-5 text-dark">{rupees(b.totalFare)}</div>
            <div className="small text-secondary">
              {active === b.passengers.length ? `${b.passengers.length} passengers` : `${active} of ${b.passengers.length} active`}
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
                <span className={`pax-status ps-${p.status.toLowerCase()}`}>{passengerStatus(p)}</span>
                {p.status === 'WL' && p.currentWlPosition != null && p.wlNumber !== p.currentWlPosition && (
                  <div className="small text-secondary">Booked at WL {p.wlNumber}</div>
                )}
              </td>
              {actions && <td className="text-end pe-3">{actions(p)}</td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {footer}
    </Card>
  );
}
