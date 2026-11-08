import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { customerApi } from '../../api.js';
import { useSession } from '../../session.jsx';
import { Button, Input, Note, Select, todayIso } from '../../components/ui.jsx';
import ChartBoard from '../../components/ChartBoard.jsx';

/**
 * Chart & vacancy: once a train's chart is prepared (4 hours before departure), anyone can see
 * which berths are vacant, coach by coach. Names, ages and PNRs are never shown here.
 */
export default function ChartVacancy() {
  const [params, setParams] = useSearchParams();
  const { notifyError } = useSession();
  const [train, setTrain] = useState(params.get('train') || '');
  const [date, setDate] = useState(params.get('date') || todayIso());
  const [view, setView] = useState(null);
  const [notReady, setNotReady] = useState('');
  const [busy, setBusy] = useState(false);
  const [journey, setJourney] = useState({ from: '', to: '' });
  const [trainError, setTrainError] = useState('');

  const load = async (t = train, d = date) => {
    if (!/^\d{5}$/.test(t)) {
      setTrainError('Train number must be 5 digits.');
      return;
    }
    setTrainError('');
    setBusy(true);
    setNotReady('');
    try {
      const res = await customerApi.chart(t, d);
      setView(res.data2);
      setJourney({ from: '', to: '' });
      setParams({ train: t, date: d }, { replace: true });
    } catch (err) {
      setView(null);
      if (err.status === 409 || err.status === 400) setNotReady(err.message);
      else notifyError(err.unexpected ? undefined : err.message);
    } finally {
      setBusy(false);
    }
  };

  // Opened from a ticket's "View chart" link
  useEffect(() => {
    if (params.get('train')) load(params.get('train'), params.get('date') || todayIso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const from = journey.from === '' ? null : Number(journey.from);
  const to = journey.to === '' ? null : Number(journey.to);
  const picked = from != null && to != null && to > from ? { from, to } : null;

  return (
    <div className="container py-4 vstack gap-4">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-clipboard-check text-accent me-2" aria-hidden="true" />
            Chart &amp; vacancy
          </h1>
          <p className="text-secondary mb-3">
            See which berths are still vacant once the chart is prepared, 4 hours before the train leaves its first station.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            noValidate
          >
            <Row className="g-3 align-items-end">
              <Col xs={12} sm={4} md={3}>
                <Input
                  label="Train number"
                  inputMode="numeric"
                  placeholder="12564"
                  maxLength={5}
                  value={train}
                  error={trainError}
                  onChange={(e) => setTrain(e.target.value.replace(/\D/g, '').slice(0, 5))}
                />
              </Col>
              <Col xs={7} sm={4} md={3}>
                <Input label="Journey date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Col>
              <Col xs={5} sm={4} md={2} className="d-grid">
                <Button type="submit" variant="accent" busy={busy} busyText="Loading…">
                  Show chart
                </Button>
              </Col>
            </Row>
          </form>
          {notReady && (
            <div className="mt-3">
              <Note tone="warn">{notReady}</Note>
            </div>
          )}
        </Card.Body>
      </Card>

      {view && (
        <Card className="shadow-sm">
          <Card.Body className="p-4 vstack gap-3">
            <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
              <h2 className="h5 mb-0">
                {view.trainName} ({view.trainNumber})
              </h2>
              <span className="small text-secondary">
                {new Date(view.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {view.preparedAt ? `, chart prepared ${view.preparedAt}` : ''}
              </span>
            </div>

            <Row className="g-3 align-items-end">
              <Col xs={6} md={4}>
                <Select label="Boarding at" value={journey.from} onChange={(e) => setJourney((j) => ({ ...j, from: e.target.value }))}>
                  <option value="">Whole route</option>
                  {view.stops.slice(0, -1).map((s, i) => (
                    <option key={i} value={i}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Col>
              <Col xs={6} md={4}>
                <Select label="Getting off at" value={journey.to} onChange={(e) => setJourney((j) => ({ ...j, to: e.target.value }))}>
                  <option value="">Whole route</option>
                  {view.stops.map((s, i) =>
                    from == null || i > from ? (
                      <option key={i} value={i}>
                        {s}
                      </option>
                    ) : null
                  )}
                </Select>
              </Col>
              <Col xs={12} md={4} className="small text-secondary">
                Pick your stations to see the berths free for your journey.
              </Col>
            </Row>

            <ChartBoard view={view} journey={picked} />
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
