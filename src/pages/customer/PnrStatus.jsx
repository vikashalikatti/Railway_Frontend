import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { customerApi, quotaOf, SEAT_TYPES } from '../../api.js';
import { Button, Input, Note, rupees } from '../../components/ui.jsx';

const STATUS = {
  CONFIRMED: ['Confirmed', 'success'],
  PARTIALLY_CONFIRMED: ['Partly confirmed', 'warning'],
  WAITLISTED: ['Waitlisted', 'warning'],
  CANCELLED: ['Cancelled', 'danger'],
};

/** PNR status for anyone, no log-in: like the railway's PNR enquiry, without names */
export default function PnrStatus() {
  const [params, setParams] = useSearchParams();
  const [pnr, setPnr] = useState(params.get('pnr') || '');
  const [view, setView] = useState(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const look = async (value = pnr) => {
    if (!/^\d{6,12}$/.test(value)) {
      setProblem('Enter the PNR number from your ticket.');
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const res = await customerApi.publicPnr(value);
      setView(res.data2);
      setParams({ pnr: value }, { replace: true });
    } catch (err) {
      setView(null);
      setProblem(err.unexpected ? 'We couldn’t check this PNR right now. Try again in a moment.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.get('pnr')) look(params.get('pnr'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls = view && SEAT_TYPES.find((t) => t.id === view.seatType);
  const [label, bg] = (view && STATUS[view.status]) || ['', 'secondary'];

  return (
    <div className="container py-4 vstack gap-4" style={{ maxWidth: 820 }}>
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-search text-accent me-2" aria-hidden="true" />
            PNR status
          </h1>
          <p className="text-secondary mb-3">Check any ticket’s status without logging in.</p>
          <form
            className="d-flex flex-wrap gap-2 align-items-end"
            onSubmit={(e) => {
              e.preventDefault();
              look();
            }}
            noValidate
          >
            <div style={{ minWidth: 220 }} className="flex-grow-1">
              <Input
                label="PNR number"
                inputMode="numeric"
                maxLength={12}
                value={pnr}
                error={problem && !view ? problem : ''}
                onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button type="submit" variant="accent" busy={busy} busyText="Checking…">
              Check status
            </Button>
          </form>
        </Card.Body>
      </Card>

      {view && (
        <Card className="shadow-sm">
          <Card.Header className="d-flex justify-content-between align-items-center bg-white py-3">
            <div>
              <div className="small text-secondary">PNR</div>
              <div className="fs-4 fw-bold">{view.pnr}</div>
            </div>
            <Badge bg={bg} text={bg === 'warning' ? 'dark' : undefined} className="px-3 py-2">
              {label}
            </Badge>
          </Card.Header>
          <Card.Body>
            <div className="fw-bold">
              {view.trainName} ({view.trainNumber})
            </div>
            <div className="text-secondary small">
              {view.fromStation} to {view.toStation},{' '}
              {new Date(view.journeyDate + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="text-secondary small">
              {cls ? `${cls.label} (${cls.short})` : view.seatType}, {quotaOf(view.quota).label} quota
              {view.chartStatus === 'PREPARED' || view.chartStatus === 'FINAL' ? ', chart prepared' : ', chart not prepared yet'}
            </div>
            {view.refundAmount > 0 && <Note>Refund of {rupees(view.refundAmount)} for this booking.</Note>}
          </Card.Body>
          <Table responsive className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th scope="col" className="ps-3">Passenger</th>
                <th scope="col">Booking status</th>
                <th scope="col">Current status</th>
              </tr>
            </thead>
            <tbody>
              {view.passengers.map((p) => (
                <tr key={p.no}>
                  <td className="ps-3">Passenger {p.no}</td>
                  <td className="text-secondary">{p.bookingStatus}</td>
                  <td className="fw-semibold">{p.currentStatus}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Card.Footer className="bg-white small">
            <Link to={`/chart?train=${view.trainNumber}&date=${view.journeyDate}`}>Chart &amp; vacancy for this train</Link>
          </Card.Footer>
        </Card>
      )}
    </div>
  );
}
