import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BERTH_LABELS,
  bedrollIncluded,
  bedrollOffered,
  customerApi,
  extrasFare,
  isChild,
  isInfant,
  MEALS,
  quotaOf,
  quotaProblem,
  ticketFare,
} from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { Button, Input, Note, Select, rupees } from '../../components/ui.jsx';
import { check, focusFirstError, rules } from '../../validate.js';
import { digits } from '../../useForm.js';
import Ticket from './Ticket.jsx';

const blank = () => ({ name: '', age: '', gender: '', berthPreference: '', noBerth: false, meal: 'NONE', bedroll: false });
const MAX_INFANTS = 2;

// Same checks as signup, worded for a passenger
const reword = (rule, from, to) => (v) => rule(v).replace(from, to);
const passengerSchema = {
  name: reword(rules.personName, 'your full name', 'the passenger’s name'),
  // 0 is fine here: babies under 1 travel as infants
  age: (v) => (v === '' || v == null ? 'Enter the passenger’s age.' : Number(v) > 120 ? 'Enter an age up to 120.' : ''),
  gender: rules.required('the gender'),
};

export default function BookingPanel({ train, seatClass, availability, date, from, to, quota = 'GN', onClose, onBooked }) {
  const q = quotaOf(quota);
  const MAX_PASSENGERS = q.max + MAX_INFANTS; // rows: passengers plus up to 2 children under 5
  const { session, notify } = useSession();
  const { busy, run } = useAction();
  const [passengers, setPassengers] = useState([blank()]);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([{}]); // one { field: message } per passenger
  const [formEl, setFormEl] = useState(null);

  const preferences = availability?.berthPreferences || [];
  const withoutBerth = (p) => isInfant(p.age) || (isChild(p.age) && p.noBerth);
  const berthCount = passengers.filter((p) => !withoutBerth(p)).length;
  const infants = passengers.filter((p) => isInfant(p.age)).length;
  const onWaitlist = availability && availability.available < berthCount;
  const [saved, setSaved] = useState([]);
  const [saveNew, setSaveNew] = useState(true);

  useEffect(() => {
    customerApi
      .savedPassengers(session.token)
      .then((res) => setSaved(res.data2 || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Puts a saved traveller into the first empty row, or a new row */
  const addSaved = (sp) => {
    const filled = {
      ...blank(),
      name: sp.name,
      age: String(sp.age),
      gender: sp.gender,
      berthPreference: preferences.includes(sp.berthPreference) ? sp.berthPreference : '',
      meal: sp.meal || 'NONE',
    };
    const empty = passengers.findIndex((p) => !p.name.trim() && p.age === '');
    if (empty >= 0) setPassengers(passengers.map((p, j) => (j === empty ? filled : p)));
    else if (passengers.length < MAX_PASSENGERS) {
      setPassengers([...passengers, filled]);
      setErrors([...errors, {}]);
    }
  };
  const onBooking = new Set(passengers.map((p) => p.name.trim().toLowerCase()));
  // Premium Tatkal, Ladies, Senior citizen and after-chart bookings have no waitlist
  const noWaitlist = !q.wl || availability?.chartPrepared;
  const tooMany = onWaitlist && noWaitlist;
  const rulesProblem =
    quotaProblem(quota, passengers.filter((p) => !isInfant(p.age))) ||
    (infants > MAX_INFANTS ? `Up to ${MAX_INFANTS} children under 5 can travel on one booking.` : '') ||
    (passengers.length > 0 && passengers.every((p) => p.age !== '') && berthCount === 0
      ? 'At least one passenger needs a berth: children without a berth travel with someone who has one.'
      : '');

  const update = (i, k, v) => {
    setPassengers((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
    if (errors[i]?.[k] && passengerSchema[k]) {
      setErrors((es) => es.map((e, j) => (j === i ? { ...e, [k]: passengerSchema[k](v) } : e)));
    }
  };
  const blur = (i, k) =>
    passengerSchema[k] && setErrors((es) => es.map((e, j) => (j === i ? { ...e, [k]: passengerSchema[k](passengers[i][k]) } : e)));
  const add = () => {
    if (passengers.length >= MAX_PASSENGERS) return;
    setPassengers([...passengers, blank()]);
    setErrors([...errors, {}]);
  };
  const remove = (i) => {
    setPassengers(passengers.filter((_, j) => j !== i));
    setErrors(errors.filter((_, j) => j !== i));
  };

  const submit = (e) => {
    e.preventDefault();
    const all = passengers.map((p) => check(p, passengerSchema));
    // the same person can't be booked twice in one booking
    const seen = {};
    passengers.forEach((p, i) => {
      const key = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key) return;
      if (seen[key] !== undefined && !all[i].name) all[i].name = 'This passenger is already on the booking.';
      seen[key] = i;
    });
    setErrors(all);
    if (all.some((x) => Object.keys(x).length)) {
      setTimeout(() => focusFirstError(formEl), 0);
      return;
    }
    if (quotaProblem(quota, passengers) || tooMany) return; // shown above the passengers
    run(async () => {
      const res = await customerApi.book(session.token, {
        trainNo: train.trainNumber,
        seatType: seatClass.id,
        date,
        from,
        to,
        quota,
        passengers: passengers.map((p) => ({
          name: p.name.trim(),
          age: Number(p.age),
          gender: p.gender,
          berthPreference: withoutBerth(p) ? null : p.berthPreference || null,
          noBerth: isChild(p.age) && !!p.noBerth,
          meal: p.meal || 'NONE',
          bedroll: !!p.bedroll && bedrollOffered(seatClass.id),
        })),
      });
      setResult(res.data2);
      notify(res.message, 'good');
      if (saveNew) {
        // add new travellers to the saved list (in the background; a failure here doesn't matter)
        const known = new Set(saved.map((x) => x.name.toLowerCase()));
        passengers
          .filter((p) => !known.has(p.name.trim().toLowerCase()))
          .forEach((p) =>
            customerApi
              .savePassenger(session.token, { name: p.name.trim(), age: Number(p.age), gender: p.gender, berthPreference: p.berthPreference || null, meal: p.meal })
              .catch(() => {})
          );
      }
      onBooked?.();
    });
  };

  const fareTotal = availability
    ? passengers.reduce((sum, p) => sum + ticketFare(p, availability.fare) + extrasFare(p, seatClass.id), 0)
    : null;
  const travelDate = new Date(date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (result) {
    return (
      <div className="border-top p-3 p-md-4 vstack gap-3">
        <Ticket booking={result} />
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} variant="primary" to="/bookings">
            <i className="bi bi-ticket-perforated" aria-hidden="true" />
            Go to my bookings
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="border-top p-3 p-md-4 vstack gap-3" onSubmit={submit} ref={setFormEl} noValidate>
      <div className="d-flex justify-content-between align-items-baseline gap-3">
        <h3 className="h5 mb-0">
          Book {seatClass.label}, {travelDate}
          {quota !== 'GN' && <span className="badge text-bg-warning ms-2 align-middle">{q.label}</span>}
        </h3>
        <button type="button" className="btn btn-link btn-sm p-0" onClick={onClose}>
          Cancel
        </button>
      </div>

      {q.hint && <Note>{q.hint}</Note>}

      {tooMany && (
        <Note tone="warn">
          {availability.available === 0 ? 'No seats are left' : `Only ${availability.available} ${availability.available === 1 ? 'seat is' : 'seats are'} left`}
          {availability.chartPrepared
            ? ', and the chart has been prepared, so there is no waitlist.'
            : ` in ${q.label} quota, which has no waitlist. Remove passengers or search again in General quota.`}
        </Note>
      )}

      {onWaitlist && !noWaitlist && (
        <Note tone="warn">
          {availability.available > 0
            ? `Only ${availability.available} ${availability.available === 1 ? 'seat is' : 'seats are'} left. The other passengers will be waitlisted and confirmed automatically if someone cancels.`
            : `No seats are left in ${quota === 'GN' ? 'this class' : `${q.label} quota`}. Passengers will be waitlisted (${q.wl}) and confirmed automatically if someone cancels.`}
        </Note>
      )}

      <p className="small text-secondary mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true" />
        Passengers aged 60 or over get a lower berth when one is free.
      </p>

      {saved.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-secondary">Saved passengers:</span>
          {saved.map((sp) => {
            const added = onBooking.has(sp.name.toLowerCase());
            return (
              <button
                type="button"
                key={sp.id}
                className={`btn btn-sm rounded-pill ${added ? 'btn-secondary' : 'btn-outline-primary'}`}
                disabled={added || passengers.length >= MAX_PASSENGERS}
                onClick={() => addSaved(sp)}
              >
                <i className={`bi ${added ? 'bi-check-lg' : 'bi-person-plus'} me-1`} aria-hidden="true" />
                {sp.name} ({sp.age})
              </button>
            );
          })}
        </div>
      )}

      {passengers.map((p, i) => (
        <fieldset className="border rounded-3 p-3 pt-2" key={i}>
          <legend className="float-none w-auto px-2 fs-6 fw-bold mb-0">Passenger {i + 1}</legend>
          <Row className="g-3">
            <Col md={5}>
              <Input
                label="Name"
                autoComplete="off"
                value={p.name}
                error={errors[i]?.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                onBlur={() => blur(i, 'name')}
              />
            </Col>
            <Col xs={4} md={2}>
              <Input
                label="Age"
                inputMode="numeric"
                value={p.age}
                error={errors[i]?.age}
                onChange={(e) => update(i, 'age', digits(3)(e.target.value))}
                onBlur={() => blur(i, 'age')}
              />
            </Col>
            <Col xs={8} md={2}>
              <Select
                label="Gender"
                value={p.gender}
                error={errors[i]?.gender}
                onChange={(e) => update(i, 'gender', e.target.value)}
                onBlur={() => blur(i, 'gender')}
              >
                <option value="" disabled>
                  Choose
                </option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Col>
            <Col md={3}>
              <Select
                label="Berth preference"
                value={withoutBerth(p) ? '' : p.berthPreference}
                disabled={withoutBerth(p)}
                onChange={(e) => update(i, 'berthPreference', e.target.value)}
              >
                <option value="">No preference</option>
                {preferences.map((b) => (
                  <option key={b} value={b}>
                    {BERTH_LABELS[b] || b}
                  </option>
                ))}
              </Select>
            </Col>
          </Row>
          <div className="d-flex flex-wrap align-items-center gap-3 mt-2 small">
            {isInfant(p.age) && (
              <span className="text-success">
                <i className="bi bi-emoji-smile me-1" aria-hidden="true" />
                Under 5: travels free, without a berth
              </span>
            )}
            {isChild(p.age) && (
              <label className="form-check mb-0">
                <input className="form-check-input" type="checkbox" checked={!!p.noBerth} onChange={(e) => update(i, 'noBerth', e.target.checked)} />
                <span className="form-check-label">No berth (half fare)</span>
              </label>
            )}
            <label className="d-flex align-items-center gap-2 mb-0">
              Meal
              <select
                className="form-select form-select-sm w-auto"
                value={p.meal || 'NONE'}
                onChange={(e) => update(i, 'meal', e.target.value)}
                aria-label={`Passenger ${i + 1} meal`}
              >
                {MEALS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.price ? ` (₹${m.price})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {bedrollOffered(seatClass.id) && (
              <label className="form-check mb-0">
                <input className="form-check-input" type="checkbox" checked={!!p.bedroll} onChange={(e) => update(i, 'bedroll', e.target.checked)} />
                <span className="form-check-label">Bedroll (₹150)</span>
              </label>
            )}
            {bedrollIncluded(seatClass.id) && <span className="text-secondary">Bedroll included</span>}
          </div>
          {passengers.length > 1 && (
            <button type="button" className="btn btn-link btn-sm text-danger p-0 mt-2" onClick={() => remove(i)}>
              <i className="bi bi-x-circle me-1" aria-hidden="true" />
              Remove passenger {i + 1}
            </button>
          )}
        </fieldset>
      ))}

      {rulesProblem && (
        <Note tone="warn">
          {rulesProblem}
        </Note>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        {passengers.length < MAX_PASSENGERS ? (
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={add}>
            <i className="bi bi-person-plus me-1" aria-hidden="true" />
            Add another passenger
          </button>
        ) : (
          <span className="small text-secondary">
            Up to {q.max} passengers, plus {MAX_INFANTS} children under 5
          </span>
        )}
        <label className="form-check small mb-0">
          <input className="form-check-input" type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} />
          <span className="form-check-label">Save new passengers for next time</span>
        </label>
        <div className="d-flex align-items-center gap-3">
          {fareTotal != null && <span className="fs-4 fw-bold">{rupees(fareTotal)}</span>}
          <Button busy={busy} busyText="Booking…" type="submit" variant="accent" size="lg" disabled={!!rulesProblem || tooMany}>
            Book {passengers.length === 1 ? 'ticket' : `${passengers.length} tickets`}
          </Button>
        </div>
      </div>
    </form>
  );
}
