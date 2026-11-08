import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BERTH_LABELS, customerApi, quotaOf, quotaProblem } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { Button, Input, Note, Select, rupees } from '../../components/ui.jsx';
import { check, focusFirstError, rules } from '../../validate.js';
import { digits } from '../../useForm.js';
import Ticket from './Ticket.jsx';

const blank = () => ({ name: '', age: '', gender: '', berthPreference: '' });

// Same checks as signup, worded for a passenger
const reword = (rule, from, to) => (v) => rule(v).replace(from, to);
const passengerSchema = {
  name: reword(rules.personName, 'your full name', 'the passenger’s name'),
  age: reword(rules.age, 'your age', 'the passenger’s age'),
  gender: rules.required('the gender'),
};

export default function BookingPanel({ train, seatClass, availability, date, from, to, quota = 'GN', onClose, onBooked }) {
  const q = quotaOf(quota);
  const MAX_PASSENGERS = q.max;
  const { session, notify } = useSession();
  const { busy, run } = useAction();
  const [passengers, setPassengers] = useState([blank()]);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([{}]); // one { field: message } per passenger
  const [formEl, setFormEl] = useState(null);

  const preferences = availability?.berthPreferences || [];
  const onWaitlist = availability && availability.available < passengers.length;
  // Premium Tatkal, Ladies, Senior citizen and after-chart bookings have no waitlist
  const noWaitlist = !q.wl || availability?.chartPrepared;
  const tooMany = onWaitlist && noWaitlist;
  const rulesProblem = quotaProblem(quota, passengers);

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
          berthPreference: p.berthPreference || null,
        })),
      });
      setResult(res.data2);
      notify(res.message, 'good');
      onBooked?.();
    });
  };

  const fareTotal = availability ? availability.fare * passengers.length : null;
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
              <Select label="Berth preference" value={p.berthPreference} onChange={(e) => update(i, 'berthPreference', e.target.value)}>
                <option value="">No preference</option>
                {preferences.map((b) => (
                  <option key={b} value={b}>
                    {BERTH_LABELS[b] || b}
                  </option>
                ))}
              </Select>
            </Col>
          </Row>
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
          <span className="small text-secondary">Up to {MAX_PASSENGERS} passengers per booking</span>
        )}
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
