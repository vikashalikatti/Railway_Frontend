import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, rupees } from '../../components/ui.jsx';
import useConfirm from '../../components/useConfirm.jsx';
import { passengerStatus } from '../customer/Ticket.jsx';

/** Admin: find customers, see their bookings, block or unblock them */
export default function AdminCustomers() {
  const { session, notify } = useSession();
  const [confirm, confirmDialog] = useConfirm();
  const load = useAction();
  const act = useAction();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null); // customer id whose bookings are shown
  const [bookings, setBookings] = useState([]);
  const timer = useRef(null);

  const search = useCallback(
    (text) =>
      load.run(async () => {
        const res = await adminApi.customers(session.token, text, 50);
        setRows(res.data2 || []);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.token]
  );

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
  }, [search]);

  const onType = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v.trim()), 300);
  };

  const replace = (c) => setRows((list) => list.map((x) => (x.id === c.id ? c : x)));

  const toggleBlock = async (c) => {
    if (c.blocked) {
      act.run(async () => {
        const res = await adminApi.unblockCustomer(session.token, c.id);
        replace(res.data2);
        notify(res.message, 'success');
      });
      return;
    }
    let reason = '';
    const ok = await confirm({
      title: `Block ${c.name || c.email}?`,
      body: (
        <div className="vstack gap-2">
          <p className="mb-0">They are logged out everywhere and can’t log in or book until you unblock them. Their tickets stay as they are.</p>
          <label className="form-label mb-0" htmlFor="block-reason">
            Reason (optional, kept in the audit log)
          </label>
          <input id="block-reason" className="form-control" maxLength={200} onChange={(e) => (reason = e.target.value)} />
        </div>
      ),
      confirmLabel: 'Block customer',
      cancelLabel: 'Keep active',
      danger: true,
    });
    if (!ok) return;
    act.run(async () => {
      const res = await adminApi.blockCustomer(session.token, c.id, reason);
      replace(res.data2);
      notify(res.message, 'success');
    });
  };

  const showBookings = (c) => {
    if (open === c.id) {
      setOpen(null);
      return;
    }
    setOpen(c.id);
    setBookings([]);
    act.run(async () => setBookings((await adminApi.customerBookings(session.token, c.id)).data2 || []));
  };

  return (
    <div className="container py-4 vstack gap-4">
      {confirmDialog}
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-people text-accent me-2" aria-hidden="true" />
            Customers
          </h1>
          <p className="text-secondary mb-3">Find a customer by name, email or mobile number, see their bookings, or block their account.</p>
          <input
            type="search"
            className="form-control"
            placeholder="Name, email or mobile"
            aria-label="Search customers"
            maxLength={60}
            value={q}
            onChange={(e) => onType(e.target.value)}
          />
        </Card.Body>
      </Card>

      {rows && (
        <Card className="shadow-sm">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th scope="col" className="ps-3">Customer</th>
                <th scope="col">Mobile</th>
                <th scope="col">Bookings</th>
                <th scope="col">Account</th>
                <th scope="col" className="pe-3 text-end">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="ps-3 text-secondary">
                    No customer matches “{q.trim()}”.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td className="ps-3">
                      <span className="fw-semibold">{c.name || '(no name)'}</span>
                      <span className="d-block small text-secondary">{c.email}</span>
                    </td>
                    <td>{c.mobile || ''}</td>
                    <td>
                      <button type="button" className="btn btn-link btn-sm p-0" onClick={() => showBookings(c)} aria-expanded={open === c.id}>
                        {c.bookings} {c.bookings === 1 ? 'booking' : 'bookings'}
                      </button>
                    </td>
                    <td>
                      {c.blocked ? (
                        <Badge bg="danger" title={c.blockedReason || undefined}>
                          Blocked
                        </Badge>
                      ) : c.verified ? (
                        <Badge bg="success">Active</Badge>
                      ) : (
                        <Badge bg="secondary">Email not verified</Badge>
                      )}
                    </td>
                    <td className="pe-3 text-end">
                      <Button size="sm" variant={c.blocked ? 'outline' : 'danger'} disabled={act.busy} onClick={() => toggleBlock(c)}>
                        {c.blocked ? 'Unblock' : 'Block'}
                      </Button>
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="table-active">
                      <td colSpan={5} className="ps-3">
                        {bookings.length === 0 ? (
                          <span className="small text-secondary">{act.busy ? 'Loading…' : 'No bookings.'}</span>
                        ) : (
                          <ul className="list-unstyled small mb-0 vstack gap-1">
                            {bookings.map((b) => (
                              <li key={b.bookingId}>
                                <strong>PNR {b.bookingId}</strong>, {b.trainNumber} {b.trainName}, {b.boardingDate || b.journeyDate}, {b.fromStation} to{' '}
                                {b.toStation}, {rupees(b.totalFare)}, {b.status.replace('_', ' ').toLowerCase()}:{' '}
                                {b.passengers.map((p) => `${p.name} ${passengerStatus(p, b.quota)}`).join('; ')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
