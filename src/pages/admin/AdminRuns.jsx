import { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { adminApi, customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, ErrorNote, Input, Select, todayIso } from '../../components/ui.jsx';
import useConfirm from '../../components/useConfirm.jsx';

/**
 * One train on one date, after it's booked:
 *  - live position and delay (shown to passengers on their tickets)
 *  - reschedule (passengers are emailed the new time)
 *  - cancel (everyone cancelled with a full refund and emailed)
 */
export default function AdminRuns() {
  const { session, notify } = useSession();
  const list = useAction();
  const load = useAction();
  const act = useAction();
  const [confirm, confirmDialog] = useConfirm();
  const [trains, setTrains] = useState([]);
  const [train, setTrain] = useState('');
  const [date, setDate] = useState(todayIso());
  const [run, setRun] = useState(null);
  const [pos, setPos] = useState({ stop: '0', departed: false, delay: '0' });
  const [late, setLate] = useState({ delay: '', reason: '' });
  const [reason, setReason] = useState('');

  useEffect(() => {
    list.run(async () => {
      const res = await adminApi.trains(session.token);
      const ts = (res.data2 || []).filter((t) => t && typeof t === 'object');
      setTrains(ts);
      if (ts[0]) setTrain(String(ts[0].trainNumber));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (e) => {
    e?.preventDefault();
    if (!train) return;
    load.run(async () => {
      const res = await customerApi.running(train, date);
      setRun(res.data2);
      setPos({ stop: String(res.data2.currentStop ?? 0), departed: !!res.data2.departed, delay: String(res.data2.delayMinutes || 0) });
    });
  };

  const done = (res) => {
    setRun(res.data2);
    notify(res.message, 'success');
  };

  const updatePosition = (e) => {
    e.preventDefault();
    act.run(async () =>
      done(await adminApi.runPosition(session.token, train, { date, stop: Number(pos.stop), departed: pos.departed, delayMinutes: Number(pos.delay || 0) }))
    );
  };

  const reschedule = (e) => {
    e.preventDefault();
    act.run(async () => done(await adminApi.rescheduleRun(session.token, train, { date, delayMinutes: Number(late.delay || 0), reason: late.reason })));
  };

  const cancelRun = async () => {
    const ok = await confirm({
      title: `Cancel train ${train} on ${date}?`,
      body: 'Every passenger on this date is cancelled with a full refund and emailed. New bookings for this date are refused. This can’t be undone.',
      confirmLabel: 'Cancel this train',
      cancelLabel: 'Keep it running',
      danger: true,
    });
    if (!ok) return;
    act.run(async () => done(await adminApi.cancelRun(session.token, train, { date, reason })));
  };

  return (
    <div className="container py-4 vstack gap-4">
      {confirmDialog}
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-broadcast text-accent me-2" aria-hidden="true" />
            Train runs
          </h1>
          <p className="text-secondary mb-3">Update where a train is, reschedule it, or cancel it for a date.</p>
          <form onSubmit={show} noValidate>
            <Row className="g-3 align-items-end">
              <Col md={5}>
                <Select label="Train" value={train} onChange={(e) => setTrain(e.target.value)}>
                  {trains.map((t) => (
                    <option key={t.trainNumber} value={t.trainNumber}>
                      {t.trainNumber} {t.trainName}
                    </option>
                  ))}
                </Select>
              </Col>
              <Col xs={7} md={3}>
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Col>
              <Col xs={5} md={2} className="d-grid">
                <Button type="submit" variant="accent" busy={load.busy} busyText="Loading…" disabled={!train}>
                  Show
                </Button>
              </Col>
            </Row>
          </form>
        </Card.Body>
      </Card>

      {run && (
        <>
          <Card className="shadow-sm">
            <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h2 className="h6 mb-0">
                {run.trainName} ({run.trainNumber}), {run.journeyDate}
              </h2>
              {run.cancelled ? (
                <Badge bg="danger" className="px-3 py-2">Cancelled{run.cancelReason ? `: ${run.cancelReason}` : ''}</Badge>
              ) : (
                <Badge bg={run.delayMinutes > 0 ? 'warning' : 'success'} text={run.delayMinutes > 0 ? 'dark' : undefined} className="px-3 py-2">
                  {run.delayMinutes > 0 ? `${run.delayMinutes} min late` : 'On time'}
                  {run.updatedAt ? `, updated ${run.updatedAt}` : ''}
                </Badge>
              )}
            </Card.Header>
            <Table responsive size="sm" className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th scope="col" className="ps-3">Station</th>
                  <th scope="col">Arrives</th>
                  <th scope="col">Departs</th>
                  <th scope="col">Expected</th>
                  <th scope="col" className="pe-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {run.stops.map((s, i) => (
                  <tr key={i} className={s.current ? 'table-warning' : ''}>
                    <td className="ps-3 fw-semibold">
                      {s.station} {s.code && <span className="text-secondary fw-normal">({s.code})</span>}
                    </td>
                    <td>{s.scheduledArrival || '–'}</td>
                    <td>{s.scheduledDeparture || '–'}</td>
                    <td>{run.delayMinutes > 0 ? s.expectedDeparture || s.expectedArrival : '–'}</td>
                    <td className="pe-3 small">{s.current ? (run.departed ? 'Left' : 'At the station') : s.passed ? 'Passed' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {!run.cancelled && (
            <Row className="g-4">
              <Col lg={4}>
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-4">
                    <h3 className="h6">Live position</h3>
                    <p className="small text-secondary">Shown to passengers on their tickets. No email.</p>
                    <form onSubmit={updatePosition} className="vstack gap-2" noValidate>
                      <Select label="Train is at" value={pos.stop} onChange={(e) => setPos((p) => ({ ...p, stop: e.target.value }))}>
                        {run.stops.map((s, i) => (
                          <option key={i} value={i}>
                            {s.station}
                          </option>
                        ))}
                      </Select>
                      <label className="form-check">
                        <input className="form-check-input" type="checkbox" checked={pos.departed} onChange={(e) => setPos((p) => ({ ...p, departed: e.target.checked }))} />
                        <span className="form-check-label">Has left this station</span>
                      </label>
                      <Input label="Running late by (minutes)" inputMode="numeric" value={pos.delay} onChange={(e) => setPos((p) => ({ ...p, delay: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                      <Button type="submit" variant="outline" busy={act.busy} busyText="Saving…">
                        Update position
                      </Button>
                    </form>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-4">
                    <h3 className="h6">Reschedule</h3>
                    <p className="small text-secondary">Everyone booked is emailed the new departure time from their station.</p>
                    <form onSubmit={reschedule} className="vstack gap-2" noValidate>
                      <Input label="Leaves late by (minutes)" inputMode="numeric" placeholder="90" value={late.delay} onChange={(e) => setLate((l) => ({ ...l, delay: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                      <Input label="Reason (optional)" maxLength={200} value={late.reason} onChange={(e) => setLate((l) => ({ ...l, reason: e.target.value }))} />
                      <Button type="submit" variant="outline" busy={act.busy} busyText="Saving…" disabled={late.delay === ''}>
                        Reschedule and email passengers
                      </Button>
                    </form>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="shadow-sm h-100 border-danger-subtle">
                  <Card.Body className="p-4 vstack gap-2">
                    <h3 className="h6 text-danger">Cancel this train</h3>
                    <p className="small text-secondary mb-1">Everyone on this date is cancelled, refunded in full and emailed.</p>
                    <Input label="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button variant="danger" busy={act.busy} busyText="Cancelling…" onClick={cancelRun}>
                      Cancel train on {run.journeyDate}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
          <ErrorNote>{act.error}</ErrorNote>
        </>
      )}
    </div>
  );
}
