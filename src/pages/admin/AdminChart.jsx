import { useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { adminApi, BERTH_LABELS, SEAT_TYPES } from '../../api.js';
import TrainPicker from '../../components/TrainPicker.jsx';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, todayIso } from '../../components/ui.jsx';
import ChartBoard from '../../components/ChartBoard.jsx';

const STAGE = [
  { label: 'Chart not prepared yet', bg: 'secondary' },
  { label: 'Chart prepared', bg: 'success' },
  { label: 'Final chart prepared', bg: 'primary' },
];

/** Admin's reservation chart: the berth map plus every passenger, at any time */
export default function AdminChart() {
  const { session } = useSession();
  const chartLoad = useAction();
  const [train, setTrain] = useState('');
  const [date, setDate] = useState(todayIso());
  const [view, setView] = useState(null);
  const [filter, setFilter] = useState('');


  const show = (e) => {
    e.preventDefault();
    if (!train) return;
    chartLoad.run(async () => {
      const res = await adminApi.chart(session.token, train, date);
      setView(res.data2);
    });
  };

  const f = filter.trim().toLowerCase();
  const passengers = (view?.passengers || []).filter(
    (p) => !f || [p.name, String(p.pnr), p.coach, p.from, p.to].some((x) => String(x || '').toLowerCase().includes(f))
  );
  const stage = STAGE[view?.stage ?? 0] || STAGE[0];

  return (
    <div className="container py-4 vstack gap-4">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-clipboard-data text-accent me-2" aria-hidden="true" />
            Reservation charts
          </h1>
          <p className="text-secondary mb-3">
            Every passenger and berth for a train and date. Passengers only see vacant and booked berths, after the chart is prepared.
          </p>
          <form onSubmit={show} noValidate>
            <Row className="g-3 align-items-end">
              <Col xs={12} md={5}>
                <TrainPicker value={train} onChange={(no) => setTrain(no)} />
              </Col>
              <Col xs={7} md={3}>
                <Input label="Journey date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Col>
              <Col xs={5} md={2} className="d-grid">
                <Button type="submit" variant="accent" busy={chartLoad.busy} busyText="Loading…" disabled={!train}>
                  Show chart
                </Button>
              </Col>
            </Row>
          </form>
        </Card.Body>
      </Card>

      {view && (
        <>
          <Card className="shadow-sm">
            <Card.Body className="p-4 vstack gap-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h2 className="h5 mb-0">
                  {view.trainName} ({view.trainNumber}), {view.date}
                </h2>
                <Badge bg={stage.bg} className="px-3 py-2">
                  {stage.label}
                  {view.preparedAt ? `, ${view.preparedAt}` : `, due ${view.chartAt}`}
                </Badge>
              </div>
              <ChartBoard view={view} journey={null} />
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h2 className="h6 mb-0">
                Passengers <span className="text-secondary fw-normal">({view.passengers?.length || 0})</span>
              </h2>
              <input
                type="search"
                className="form-control form-control-sm"
                style={{ maxWidth: 260 }}
                placeholder="Name, PNR, coach or station"
                aria-label="Filter passengers"
                value={filter}
                maxLength={60}
                onChange={(e) => setFilter(e.target.value)}
              />
            </Card.Header>
            {passengers.length === 0 ? (
              <Card.Body className="text-secondary small">{view.passengers?.length ? 'No passenger matches.' : 'Nobody has booked this train on this date.'}</Card.Body>
            ) : (
              <Table responsive hover size="sm" className="mb-0 align-middle chart-passengers">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-3">Name</th>
                    <th scope="col">Age</th>
                    <th scope="col">Gender</th>
                    <th scope="col">PNR</th>
                    <th scope="col">Class</th>
                    <th scope="col">Berth</th>
                    <th scope="col">Journey</th>
                    <th scope="col">Quota</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="pe-3">Boarding help</th>
                  </tr>
                </thead>
                <tbody>
                  {passengers.map((p, i) => {
                    const t = SEAT_TYPES.find((x) => x.id === p.seatType);
                    return (
                      <tr key={`${p.pnr}-${i}`}>
                        <td className="ps-3 fw-semibold">{p.name}</td>
                        <td>{p.age}</td>
                        <td>{p.gender}</td>
                        <td>{p.pnr}</td>
                        <td>{t ? t.short : p.seatType}</td>
                        <td>{p.coach ? `${p.coach}/${p.seat} ${BERTH_LABELS[p.berth] || p.berth || ''}` : '–'}</td>
                        <td className="small">
                          {p.from} to {p.to}
                        </td>
                        <td className="small">{p.quota}</td>
                        <td className={`small fw-semibold ${p.status === 'CNF' ? 'text-success' : 'text-danger'}`}>{p.status}</td>
                        <td className="pe-3 small">{p.assistance || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
