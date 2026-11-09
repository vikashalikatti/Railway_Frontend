import { useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import Row from 'react-bootstrap/Row';
import { BERTH_LABELS, customerApi, MEALS } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Select } from '../../components/ui.jsx';
import { rules } from '../../validate.js';

const BLANK = { name: '', age: '', gender: '', berthPreference: '', meal: 'NONE' };

/** The passenger's saved travellers (family, friends), added to bookings in one click */
export default function SavedPassengers() {
  const { session, askLogin, notify } = useSession();
  const load = useAction();
  const save = useAction();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (session?.role !== 'customer') return;
    load.run(async () => {
      const res = await customerApi.savedPassengers(session.token);
      setList(res.data2 || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  if (session?.role !== 'customer') {
    return (
      <div className="container py-5 text-center">
        <p className="text-secondary">Log in to see your saved passengers.</p>
        <Button variant="accent" onClick={() => askLogin('Log in to see your saved passengers.')}>
          Log in
        </Button>
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const errs = {
      name: rules.personName(form.name).replace('your full name', 'the name'),
      age: form.age === '' ? 'Enter the age.' : Number(form.age) > 120 ? 'Enter an age up to 120.' : '',
      gender: form.gender ? '' : 'Choose the gender.',
    };
    Object.keys(errs).forEach((k) => !errs[k] && delete errs[k]);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.run(async () => {
      const res = await customerApi.savePassenger(session.token, { ...form, age: Number(form.age), berthPreference: form.berthPreference || null });
      setList(res.data2 || []);
      setForm(BLANK);
      notify(res.message, 'success');
    });
  };

  const remove = (sp) =>
    save.run(async () => {
      const res = await customerApi.deleteSavedPassenger(session.token, sp.id);
      setList(res.data2 || []);
      notify(res.message, 'success');
    });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'age' ? e.target.value.replace(/\D/g, '').slice(0, 3) : e.target.value }));

  return (
    <div className="container py-4 vstack gap-4" style={{ maxWidth: 900 }}>
      <div>
        <h1 className="h4 mb-1">
          <i className="bi bi-people text-accent me-2" aria-hidden="true" />
          Saved passengers
        </h1>
        <p className="text-secondary mb-0">Save the people you travel with, then add them to a booking in one click. Up to 20.</p>
      </div>

      <Card className="shadow-sm">
        {list === null ? (
          <Card.Body className="text-secondary small">Loading…</Card.Body>
        ) : list.length === 0 ? (
          <Card.Body className="text-secondary small">No saved passengers yet. Add one below, or tick “Save new passengers” when you book.</Card.Body>
        ) : (
          <ListGroup variant="flush">
            {list.map((sp) => (
              <ListGroup.Item key={sp.id} className="d-flex justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-semibold">{sp.name}</div>
                  <div className="small text-secondary">
                    {sp.age}, {sp.gender}
                    {sp.berthPreference ? `, prefers ${BERTH_LABELS[sp.berthPreference] || sp.berthPreference}` : ''}
                    {sp.meal && sp.meal !== 'NONE' ? `, ${MEALS.find((m) => m.id === sp.meal)?.label} meal` : ''}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => remove(sp)} aria-label={`Remove ${sp.name}`}>
                  <i className="bi bi-trash" aria-hidden="true" />
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card>

      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h2 className="h6 mb-3">Add a passenger</h2>
          <form onSubmit={submit} noValidate>
            <Row className="g-3">
              <Col md={4}>
                <Input label="Name" maxLength={50} value={form.name} error={errors.name} onChange={set('name')} />
              </Col>
              <Col xs={4} md={2}>
                <Input label="Age" inputMode="numeric" value={form.age} error={errors.age} onChange={set('age')} />
              </Col>
              <Col xs={8} md={2}>
                <Select label="Gender" value={form.gender} error={errors.gender} onChange={set('gender')}>
                  <option value="" disabled>
                    Choose
                  </option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </Select>
              </Col>
              <Col xs={6} md={2}>
                <Select label="Berth" value={form.berthPreference} onChange={set('berthPreference')}>
                  <option value="">No preference</option>
                  {['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW', 'AISLE'].map((b) => (
                    <option key={b} value={b}>
                      {BERTH_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </Col>
              <Col xs={6} md={2}>
                <Select label="Meal" value={form.meal} onChange={set('meal')}>
                  {MEALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Col>
            </Row>
            <Button type="submit" variant="accent" className="mt-3" busy={save.busy} busyText="Saving…">
              Save passenger
            </Button>
          </form>
        </Card.Body>
      </Card>
    </div>
  );
}
