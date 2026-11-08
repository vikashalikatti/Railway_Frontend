import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { SEAT_TYPES } from '../api.js';
import useForm from '../useForm.js';
import { rules } from '../validate.js';
import { useState } from 'react';
import { Button, todayIso } from './ui.jsx';
import StationInput from './StationInput.jsx';

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const schema = (v) => ({
  from: rules.station('boarding'),
  to: [
    rules.station('destination'),
    (to) => (to.trim() && v.from.trim().toLowerCase() === to.trim().toLowerCase() ? 'From and To can’t be the same station.' : ''),
  ],
  date: (d) => (!d ? 'Choose a date.' : d < todayIso() ? 'The date can’t be in the past.' : ''),
});

/**
 * Journey search form. "full" is the card on the home page,
 * "bar" is the modify-search strip above the results.
 */
export default function SearchCard({ initial = {}, onSearch, variant = 'full', busy = false }) {
  const form = useForm(
    {
      from: initial.fl || initial.from || '',
      to: initial.tl || initial.to || '',
      date: initial.date && initial.date >= todayIso() ? initial.date : todayIso(),
      cls: initial.cls || '',
    },
    schema
  );
  const { values: v, errors: e } = form;
  const uid = variant;

  // What was picked from the suggestions: the box shows `label`, the search sends `value` (code or city)
  const [picks, setPicks] = useState({
    from: initial.from ? { label: initial.fl || initial.from, value: initial.from } : null,
    to: initial.to ? { label: initial.tl || initial.to, value: initial.to } : null,
  });

  const swap = () => {
    form.setValues((p) => ({ ...p, from: p.to, to: p.from }));
    setPicks((p) => ({ from: p.to, to: p.from }));
  };

  const queryFor = (name, text) => {
    const pick = picks[name];
    return pick && pick.label === text ? pick.value : text.trim();
  };

  const send = (vals) =>
    onSearch({
      from: queryFor('from', vals.from),
      to: queryFor('to', vals.to),
      fl: vals.from.trim(),
      tl: vals.to.trim(),
      date: vals.date,
      cls: vals.cls,
    });

  const station = (name, label, placeholder, opts = {}) => (
    <StationInput
      label={label}
      placeholder={placeholder}
      value={v[name]}
      error={e[name]}
      labelClassName="mb-1 small"
      onChange={(text) => {
        form.setValue(name, text);
        setPicks((p) => ({ ...p, [name]: null }));
      }}
      onSelect={(sug) => {
        form.setValue(name, sug.label);
        setPicks((p) => ({ ...p, [name]: { label: sug.label, value: sug.value } }));
      }}
      {...opts}
    />
  );

  const field = (name, label, props = {}, extraClass = '') => (
    <Form.Group controlId={`${uid}-${name}`}>
      <Form.Label className="mb-1 small">{label}</Form.Label>
      <Form.Control
        {...form.bind(name, { native: true })}
        isInvalid={!!e[name]}
        aria-describedby={e[name] ? `${uid}-${name}-err` : undefined}
        className={extraClass}
        {...props}
      />
      {e[name] && (
        <Form.Control.Feedback type="invalid" id={`${uid}-${name}-err`} role="alert">
          {e[name]}
        </Form.Control.Feedback>
      )}
    </Form.Group>
  );

  const classSelect = (
    <Form.Group controlId={`${uid}-cls`}>
      <Form.Label className="mb-1 small">Class</Form.Label>
      <Form.Select {...form.bind('cls', { native: true })}>
        <option value="">All classes</option>
        {SEAT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.short})
          </option>
        ))}
      </Form.Select>
    </Form.Group>
  );

  const swapButton = (
    <button type="button" className="btn btn-outline-secondary swap-btn" onClick={swap} aria-label="Swap from and to stations" title="Swap stations">
      <i className="bi bi-arrow-left-right" aria-hidden="true" />
    </button>
  );

  if (variant === 'bar') {
    return (
      <form ref={form.formRef} onSubmit={form.submit(send)} noValidate>
        <Row className="g-2 align-items-start">
          <Col xs={12} lg>
            {station('from', 'From', 'Station code, name or city')}
          </Col>
          <Col xs="auto" className="d-none d-lg-flex align-self-end pb-1">
            {swapButton}
          </Col>
          <Col xs={12} lg>
            {station('to', 'To', 'Station code, name or city')}
          </Col>
          <Col xs={6} lg={2}>
            {field('date', 'Date of journey', { type: 'date', min: todayIso() })}
          </Col>
          <Col xs={6} lg={2}>
            {classSelect}
          </Col>
          <Col xs={12} lg="auto" className="d-grid align-self-end">
            <Button type="submit" variant="accent" busy={busy} busyText="Searching…">
              <i className="bi bi-search" aria-hidden="true" />
              Modify search
            </Button>
          </Col>
        </Row>
      </form>
    );
  }

  return (
    <Card className="search-card shadow-lg border-0">
      <Card.Body className="p-4">
        <h1 className="card-title h4 mb-4">Book train tickets</h1>
        <form ref={form.formRef} onSubmit={form.submit(send)} noValidate className="vstack gap-3">
          <div className="sc-stations vstack gap-3">
            {station('from', 'From', 'Station code, name or city', { size: 'lg', inputClassName: 'station-input pe-5' })}
            {swapButton}
            {station('to', 'To', 'Station code, name or city', { size: 'lg', inputClassName: 'station-input pe-5' })}
          </div>
          <Row className="g-3">
            <Col xs={6}>{field('date', 'Date of journey', { type: 'date', min: todayIso() })}</Col>
            <Col xs={6}>{classSelect}</Col>
          </Row>
          <div className="d-flex gap-2" role="group" aria-label="Quick dates">
            {[
              { label: 'Today', iso: todayIso() },
              { label: 'Tomorrow', iso: addDays(todayIso(), 1) },
            ].map((q) => (
              <button
                type="button"
                key={q.label}
                className={`btn btn-sm rounded-pill ${v.date === q.iso ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => form.setValue('date', q.iso)}
                aria-pressed={v.date === q.iso}
              >
                {q.label}
              </button>
            ))}
          </div>
          <Button type="submit" variant="accent" size="lg" busy={busy} busyText="Searching…">
            <i className="bi bi-search" aria-hidden="true" />
            Search trains
          </Button>
        </form>
      </Card.Body>
    </Card>
  );
}
