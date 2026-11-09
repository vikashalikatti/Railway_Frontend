import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import Card from 'react-bootstrap/Card';
import Nav from 'react-bootstrap/Nav';
import { rupees, Button } from '../../components/ui.jsx';
import useConfirm from '../../components/useConfirm.jsx';
import Ticket from './Ticket.jsx';

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** The passenger's bookings: upcoming first, with cancel per passenger or per booking */
export default function MyBookings() {
  const { session, notify, askLogin } = useSession();
  const load = useAction();
  const cancelAction = useAction();
  const [bookings, setBookings] = useState(null);
  const [cancelling, setCancelling] = useState(''); // "pnr" or "pnr:passengerId"
  const [tab, setTab] = useState('upcoming');
  const [confirm, confirmDialog] = useConfirm();

  const refresh = useCallback(() => {
    if (session?.role !== 'customer') return;
    load.run(async () => {
      const res = await customerApi.myBookings(session.token);
      setBookings(res.data2 || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cancel = async (b, p) => {
    const who = p ? `${p.name}’s ticket` : `the whole booking (PNR ${b.bookingId})`;
    // what the cancellation rules would refund right now
    let preview = null;
    try {
      preview = (await customerApi.cancelPreview(session.token, b.bookingId, p ? [p.id] : [])).data2 || null;
    } catch {
      preview = null; // the server checks again when cancelling
    }
    const refund = preview ? preview.reduce((sum, r) => sum + r.refund, 0) : null;
    const charge = preview ? preview.reduce((sum, r) => sum + r.charge, 0) : null;
    const ok = await confirm({
      title: `Cancel ${who}?`,
      body: (
        <div className="vstack gap-2">
          {preview && (
            <>
              <table className="table table-sm mb-0 refund-table">
                <thead>
                  <tr>
                    <th scope="col">Passenger</th>
                    <th scope="col" className="text-end">Paid</th>
                    <th scope="col" className="text-end">Charge</th>
                    <th scope="col" className="text-end">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.passengerId}>
                      <td>
                        {r.name}
                        <div className="small text-secondary">{r.rule}</div>
                      </td>
                      <td className="text-end">{rupees(r.paid)}</td>
                      <td className="text-end">{rupees(r.charge)}</td>
                      <td className="text-end fw-semibold">{rupees(r.refund)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mb-0">
                You get <strong>{rupees(refund)}</strong> back{charge > 0 ? ` (cancellation charges ${rupees(charge)})` : ''}, to the
                card, UPI or bank you paid with.
              </p>
            </>
          )}
          <p className="mb-0 text-secondary">Any berth you give up goes to RAC or the waitlist. This can’t be undone.</p>
        </div>
      ),
      confirmLabel: p ? `Cancel ${p.name}’s ticket` : 'Cancel booking',
      danger: true,
    });
    if (!ok) return;
    setCancelling(p ? `${b.bookingId}:${p.id}` : String(b.bookingId));
    cancelAction
      .run(async () => {
        const res = await customerApi.cancel(session.token, b.bookingId, p ? [p.id] : []);
        setBookings((list) => list.map((x) => (x.bookingId === b.bookingId ? res.data2 : x)));
        notify(res.message, 'success');
      })
      .finally(() => setCancelling(''));
  };

  if (session?.role !== 'customer') {
    return (
      <div className="container py-5" style={{ maxWidth: 520 }}>
        <Card body className="text-center py-4 shadow-sm">
          <i className="bi bi-ticket-perforated fs-1 text-secondary" aria-hidden="true" />
          <p className="text-secondary mt-2">Log in to see your bookings.</p>
          <Button variant="accent" onClick={() => askLogin('Log in to see your bookings.', null)}>
            Log in
          </Button>
        </Card>
      </div>
    );
  }

  const today = todayIso();
  const upcoming = (bookings || []).filter((b) => b.journeyDate >= today && b.status !== 'CANCELLED');
  const past = (bookings || []).filter((b) => b.journeyDate < today || b.status === 'CANCELLED');
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="container py-4 vstack gap-3">
      {confirmDialog}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <h1 className="h3 mb-0">My bookings</h1>
        <Button variant="outline" size="sm" busy={load.busy} busyText="Refreshing…" onClick={refresh}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
          Refresh status
        </Button>
      </div>

      <Nav variant="pills" activeKey={tab} onSelect={(k) => setTab(k)} className="gap-2">
        <Nav.Item>
          <Nav.Link eventKey="upcoming">Upcoming ({upcoming.length})</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="past">Past and cancelled ({past.length})</Nav.Link>
        </Nav.Item>
      </Nav>

      {bookings === null && load.busy && (
        <div className="vstack gap-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <Card className="shadow-sm placeholder-glow" key={i}>
              <Card.Header className="bg-primary-subtle">
                <span className="placeholder col-3" />
              </Card.Header>
              <Card.Body>
                <span className="placeholder col-6 mb-2" />
                <span className="placeholder col-4" />
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {bookings && shown.length === 0 && (
        <Card body className="text-center py-4">
          <i className="bi bi-calendar2-x fs-1 text-secondary" aria-hidden="true" />
          <p className="text-secondary mt-2">{tab === 'upcoming' ? 'You have no upcoming journeys.' : 'Nothing here yet.'}</p>
          {tab === 'upcoming' && (
            <Button as={Link} variant="accent" to="/">
              Book a ticket
            </Button>
          )}
        </Card>
      )}

      {shown.map((b) => {
        const canCancel = (b.boardingDate || b.journeyDate) >= today && b.status !== 'CANCELLED';
        const activeCount = b.passengers.filter((p) => p.status !== 'CAN').length;
        return (
          <Ticket
            key={b.bookingId}
            booking={b}
            token={session.token}
            actions={
              canCancel && activeCount > 1
                ? (p) =>
                    p.status !== 'CAN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        busy={cancelling === `${b.bookingId}:${p.id}`}
                        busyText="Cancelling…"
                        disabled={!!cancelling}
                        onClick={() => cancel(b, p)}
                      >
                        Cancel
                      </Button>
                    )
                : null
            }
            footer={
              canCancel && (
                <Card.Footer className="bg-body-tertiary d-flex justify-content-end">
                  <Button
                    variant="danger"
                    busy={cancelling === String(b.bookingId)}
                    busyText="Cancelling…"
                    disabled={!!cancelling}
                    onClick={() => cancel(b, null)}
                  >
                    <i className="bi bi-x-circle" aria-hidden="true" />
                    {activeCount > 1 ? 'Cancel whole booking' : 'Cancel ticket'}
                  </Button>
                </Card.Footer>
              )
            }
          />
        );
      })}
    </div>
  );
}
