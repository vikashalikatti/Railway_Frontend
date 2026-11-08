import { useState } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { adminApi, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, ErrorNote, Input, Select, todayIso } from '../../components/ui.jsx';
import { fromServer } from './trainStore.js';

const fmt = (iso) => (iso ? new Date(iso + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** "12 Nov 2026 to 20 Nov 2026", "from 12 Nov 2026", "until 20 Nov 2026" or '' (always) */
export function coachDates(c) {
  if (c.validFrom && c.validTo) return `${fmt(c.validFrom)} to ${fmt(c.validTo)}`;
  if (c.validFrom) return `from ${fmt(c.validFrom)}`;
  if (c.validTo) return `until ${fmt(c.validTo)}`;
  return '';
}

/**
 * Coach changes for rush days and timetable changes, while the train already has bookings:
 *  - add coaches from a date, for good or until an end date (their seats go to the waitlist first)
 *  - take coaches off from a date on (only stopped by confirmed passengers in them; cancelled tickets don't count)
 */
export default function CoachChanges({ train, onChange }) {
  const { session, notify } = useSession();
  const adding = useAction();
  const removing = useAction();
  const classes = SEAT_TYPES.slice().reverse();
  const [add, setAdd] = useState({ seatType: 'SLEEPER_CLASS', count: '2', from: todayIso(), to: '' });
  const [rem, setRem] = useState({ from: todayIso(), picked: [] });
  const [addError, setAddError] = useState('');

  const coaches = train.coaches || [];
  // coaches that still run on or after the chosen date can be taken off
  const removable = coaches.filter((c) => !c.validTo || c.validTo >= rem.from);

  const submitAdd = (e) => {
    e.preventDefault();
    const n = Number(add.count);
    if (!(n >= 1 && n <= 10)) return setAddError('Add 1 to 10 coaches at a time.');
    if (!add.from || add.from < todayIso()) return setAddError('The start date can’t be in the past.');
    if (add.to && add.to < add.from) return setAddError('The end date must be on or after the start date.');
    setAddError('');
    adding.run(async () => {
      const res = await adminApi.addCoachesFrom(session.token, train.trainNumber, {
        seatType: add.seatType,
        count: n,
        from: add.from,
        to: add.to || null,
      });
      notify(res.message, 'success');
      onChange(fromServer(res.data2));
    });
  };

  const submitRemove = (e) => {
    e.preventDefault();
    if (!rem.picked.length) return;
    removing.run(async () => {
      const res = await adminApi.removeCoachesFrom(session.token, train.trainNumber, { coachNumbers: rem.picked, from: rem.from });
      notify(res.message, 'success');
      setRem((r) => ({ ...r, picked: [] }));
      onChange(fromServer(res.data2));
    });
  };

  const toggle = (no) =>
    setRem((r) => ({ ...r, picked: r.picked.includes(no) ? r.picked.filter((x) => x !== no) : [...r.picked, no] }));

  return (
    <div className="border-top pt-4 mt-4 vstack gap-4">
      <div>
        <h3 className="h6 mb-1">Coach changes</h3>
        <p className="small text-secondary mb-0">
          Add coaches for rush days or take some off, from a date you choose. Tickets already booked keep their berths.
        </p>
      </div>

      <form onSubmit={submitAdd} noValidate>
        <h4 className="small fw-bold mb-2">Add coaches</h4>
        <Row className="g-2 align-items-end">
          <Col xs={12} md={4}>
            <Select label="Class" value={add.seatType} onChange={(e) => setAdd((a) => ({ ...a, seatType: e.target.value }))}>
              {classes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.short})
                </option>
              ))}
            </Select>
          </Col>
          <Col xs={4} md={2}>
            <Input
              label="Coaches"
              inputMode="numeric"
              maxLength={2}
              value={add.count}
              onChange={(e) => setAdd((a) => ({ ...a, count: e.target.value.replace(/\D/g, '') }))}
            />
          </Col>
          <Col xs={8} md={3}>
            <Input label="From" type="date" min={todayIso()} value={add.from} onChange={(e) => setAdd((a) => ({ ...a, from: e.target.value }))} />
          </Col>
          <Col xs={12} md={3}>
            <Input
              label="Until (optional)"
              type="date"
              min={add.from || todayIso()}
              value={add.to}
              hint="Leave empty to keep them"
              onChange={(e) => setAdd((a) => ({ ...a, to: e.target.value }))}
            />
          </Col>
        </Row>
        <p className="small text-secondary mt-2 mb-2">The new seats go first to passengers waiting in this class on those dates; they’re emailed their berth.</p>
        <ErrorNote>{addError || adding.error}</ErrorNote>
        <Button type="submit" variant="outline" busy={adding.busy} busyText="Adding coaches…">
          <i className="bi bi-plus-lg" aria-hidden="true" />
          Add coaches
        </Button>
      </form>

      <form onSubmit={submitRemove} noValidate>
        <h4 className="small fw-bold mb-2">Remove coaches</h4>
        <Row className="g-2 align-items-end mb-2">
          <Col xs={12} md={4}>
            <Input
              label="From"
              type="date"
              min={todayIso()}
              value={rem.from}
              onChange={(e) => setRem({ from: e.target.value, picked: [] })}
            />
          </Col>
          <Col xs={12} md={8} className="small text-secondary">
            Coaches can be taken off from a date when nobody has a confirmed berth in them on or after it. Cancelled tickets don’t count.
          </Col>
        </Row>
        <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="Coaches to remove">
          {removable.length === 0 && <span className="small text-secondary">No coaches run on or after this date.</span>}
          {removable.map((c) => {
            const on = rem.picked.includes(c.coachNumber);
            return (
              <button
                type="button"
                key={c.coachNumber}
                className={`btn btn-sm ${on ? 'btn-danger' : 'btn-outline-secondary'}`}
                aria-pressed={on}
                onClick={() => toggle(c.coachNumber)}
              >
                {c.coachNumber}
                {coachDates(c) && <small className="ms-1 opacity-75">({coachDates(c)})</small>}
              </button>
            );
          })}
        </div>
        <ErrorNote>{removing.error}</ErrorNote>
        <Button type="submit" variant="outline" busy={removing.busy} busyText="Removing…" disabled={!rem.picked.length}>
          <i className="bi bi-dash-lg" aria-hidden="true" />
          Remove {rem.picked.length ? rem.picked.join(', ') : 'coaches'} from {fmt(rem.from)}
        </Button>
      </form>
    </div>
  );
}
