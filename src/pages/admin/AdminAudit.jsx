import { useCallback, useEffect, useRef, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';

const LABELS = {
  ADMIN_LOGIN: 'Logged in',
  ADMIN_LOGIN_FAILED: 'Failed log-in',
  TRAIN_ADDED: 'Train added',
  TRAIN_DELETED: 'Train deleted',
  RUNNING_DAYS_SAVED: 'Running days saved',
  STOPS_SAVED: 'Stops saved',
  FARE_SAVED: 'Fare saved',
  COACHES_REPLACED: 'Coaches set',
  COACHES_ADDED: 'Coaches added',
  COACHES_REMOVED: 'Coaches removed',
  QUOTAS_SAVED: 'Quotas saved',
  RUN_CANCELLED: 'Run cancelled',
  RUN_RESCHEDULED: 'Run rescheduled',
  RUN_POSITION: 'Running status',
  TRAINS_IMPORT_STARTED: 'Import started',
  TRAINS_IMPORTED: 'Import finished',
  CUSTOMER_BLOCKED: 'Customer blocked',
  CUSTOMER_UNBLOCKED: 'Customer unblocked',
};

/** Admin: who changed what, and when */
export default function AdminAudit() {
  const { session } = useSession();
  const load = useAction();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const timer = useRef(null);

  const search = useCallback(
    (text) => load.run(async () => setRows((await adminApi.audit(session.token, text, 200)).data2 || [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.token]
  );

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
  }, [search]);

  return (
    <div className="container py-4 vstack gap-4">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-journal-text text-accent me-2" aria-hidden="true" />
            Audit log
          </h1>
          <p className="text-secondary mb-3">Every change made in the admin console: who, what and when. Newest first.</p>
          <input
            type="search"
            className="form-control"
            placeholder="Admin, train number, action or text"
            aria-label="Search the audit log"
            maxLength={60}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => search(e.target.value.trim()), 300);
            }}
          />
        </Card.Body>
      </Card>
      {rows && (
        <Card className="shadow-sm">
          <Table responsive size="sm" className="mb-0 align-middle audit-table">
            <thead className="table-light">
              <tr>
                <th scope="col" className="ps-3">When</th>
                <th scope="col">Admin</th>
                <th scope="col">What</th>
                <th scope="col">On</th>
                <th scope="col" className="pe-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="ps-3 text-secondary">
                    Nothing recorded{q.trim() ? ` for “${q.trim()}”` : ' yet'}.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className={a.action === 'ADMIN_LOGIN_FAILED' || a.action === 'RUN_CANCELLED' ? 'audit-flag' : ''}>
                  <td className="ps-3 text-nowrap small">{new Date(a.at).toLocaleString('en-IN')}</td>
                  <td>{a.actor}</td>
                  <td>{LABELS[a.action] || a.action}</td>
                  <td className="text-nowrap">{a.target || ''}</td>
                  <td className="pe-3 small">{a.details || ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
