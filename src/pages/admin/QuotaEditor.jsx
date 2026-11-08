import { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import { adminApi, quotaOffered, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, ErrorNote } from '../../components/ui.jsx';

const FIELDS = [
  { key: 'tatkalPct', quota: 'TQ', label: 'Tatkal' },
  { key: 'premiumPct', quota: 'PT', label: 'Premium Tatkal' },
  { key: 'ladiesPct', quota: 'LD', label: 'Ladies' },
  { key: 'seniorPct', quota: 'SS', label: 'Senior citizen' },
];

/** Problem with one class's numbers, or '' (same rules as QuotaPlanner.Shares on the server) */
function problem(row) {
  const nums = FIELDS.map((f) => Number(row[f.key] || 0));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return 'Use whole numbers from 0.';
  if (nums.reduce((a, b) => a + b, 0) > 90) return 'Quotas can take at most 90%; keep some seats for General.';
  return '';
}

/**
 * Quota split per class, in percent of the class's seats. General gets the rest.
 * Saving re-marks which quota each seat is sold in; tickets already sold keep their seats.
 */
export default function QuotaEditor({ trainNumber }) {
  const { session, notify } = useSession();
  const load = useAction();
  const save = useAction();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    load.run(async () => {
      const res = await adminApi.quotas(session.token, trainNumber);
      setRows(res.data2 || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainNumber]);

  if (!rows || rows.length === 0) return null;

  const set = (i, key, value) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value.replace(/\D/g, '').slice(0, 2) } : r)));

  const errors = rows.map(problem);
  const bad = errors.some(Boolean);

  const submit = (e) => {
    e.preventDefault();
    if (bad) return;
    const body = {};
    rows.forEach((r) => {
      body[r.seatType] = Object.fromEntries(FIELDS.map((f) => [f.key, quotaOffered(f.quota, r.seatType) ? Number(r[f.key] || 0) : 0]));
    });
    save.run(async () => {
      const res = await adminApi.saveQuotas(session.token, trainNumber, body);
      setRows(res.data2 || rows);
      notify('Quotas saved. New bookings use the new split.', 'success');
    });
  };

  return (
    <form className="border-top pt-4 mt-4" onSubmit={submit} noValidate>
      <h3 className="h6 mb-1">Quotas</h3>
      <p className="small text-secondary mb-3">
        Percent of each class’s seats. General gets the rest. Unsold quota seats go to the waitlist when the chart is prepared, 4 hours
        before departure.
      </p>
      <Table responsive size="sm" className="align-middle quota-table">
        <thead>
          <tr>
            <th scope="col">Class</th>
            {FIELDS.map((f) => (
              <th scope="col" key={f.key}>
                {f.label} %
              </th>
            ))}
            <th scope="col">Seats now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = SEAT_TYPES.find((x) => x.id === r.seatType);
            const counts = r.seatsByQuota || {};
            return (
              <tr key={r.seatType}>
                <th scope="row" className="text-nowrap">
                  {t ? t.short : r.seatType}
                  {!r.saved && <div className="small fw-normal text-secondary">default</div>}
                </th>
                {FIELDS.map((f) => {
                  const offered = quotaOffered(f.quota, r.seatType);
                  return (
                    <td key={f.key}>
                      {offered ? (
                        <input
                          className={`form-control form-control-sm ${errors[i] ? 'is-invalid' : ''}`}
                          inputMode="numeric"
                          aria-label={`${t ? t.short : r.seatType} ${f.label} percent`}
                          value={r[f.key] ?? 0}
                          onChange={(e) => set(i, f.key, e.target.value)}
                          style={{ maxWidth: 72 }}
                        />
                      ) : (
                        <span className="small text-secondary" title={`No ${f.label} quota in this class`}>
                          n/a
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="small text-secondary text-nowrap">
                  {r.seats} total: GN {counts.GN ?? 0}, TQ {counts.TQ ?? 0}, PT {counts.PT ?? 0}, LD {counts.LD ?? 0}, SS {counts.SS ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {bad && <ErrorNote>{errors.find(Boolean)}</ErrorNote>}
      <ErrorNote>{save.error}</ErrorNote>
      <Button type="submit" variant="outline" busy={save.busy} busyText="Saving quotas…" disabled={bad}>
        Save quotas
      </Button>
    </form>
  );
}
