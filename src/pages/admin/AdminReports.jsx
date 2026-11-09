import { useState } from 'react';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { adminApi, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, rupees, todayIso } from '../../components/ui.jsx';

const shift = (iso, days) => {
  const d = new Date(iso + 'T00:00');
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Occupancy, revenue, cancellations and waitlist trends for journeys between two dates */
export default function AdminReports() {
  const { session } = useSession();
  const { busy, run } = useAction();
  const [from, setFrom] = useState(shift(todayIso(), -6));
  const [to, setTo] = useState(shift(todayIso(), 7));
  const [report, setReport] = useState(null);

  const show = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await adminApi.report(session.token, from, to);
      setReport(res.data2);
    });
  };

  const t = report?.totals;
  const tiles = t
    ? [
        { label: 'Bookings', value: t.bookings.toLocaleString('en-IN') },
        { label: 'Passengers', value: t.passengers.toLocaleString('en-IN') },
        { label: 'Revenue (after refunds)', value: rupees(t.revenue) },
        { label: 'Refunds', value: rupees(t.refunds) },
        { label: 'Passengers cancelled', value: t.cancelledPassengers.toLocaleString('en-IN') },
        { label: 'Waitlisted at booking', value: t.waitlistedAtBooking.toLocaleString('en-IN') },
        { label: 'Got a seat from the waitlist', value: t.confirmedFromWaitlist.toLocaleString('en-IN') },
        { label: 'Not confirmed at charting', value: t.notConfirmedAtChart.toLocaleString('en-IN') },
        { label: 'Train runs cancelled', value: t.trainCancellations.toLocaleString('en-IN') },
      ]
    : [];

  return (
    <div className="container py-4 vstack gap-4">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-bar-chart-line text-accent me-2" aria-hidden="true" />
            Reports
          </h1>
          <p className="text-secondary mb-3">Journeys between two dates (up to 3 months).</p>
          <form onSubmit={show} noValidate>
            <Row className="g-3 align-items-end">
              <Col xs={6} md={3}>
                <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Col>
              <Col xs={6} md={3}>
                <Input label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </Col>
              <Col xs={12} md={2} className="d-grid">
                <Button type="submit" variant="accent" busy={busy} busyText="Loading…">
                  Show report
                </Button>
              </Col>
            </Row>
          </form>
        </Card.Body>
      </Card>

      {report && (
        <>
          <div className="report-tiles">
            {tiles.map((x) => (
              <div className="report-tile" key={x.label}>
                <span className="small text-secondary">{x.label}</span>
                <strong>{x.value}</strong>
              </div>
            ))}
          </div>

          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <h2 className="h6 mb-0">Occupancy by train and class</h2>
            </Card.Header>
            {report.byClass.length === 0 ? (
              <Card.Body className="small text-secondary">No trains ran in this period.</Card.Body>
            ) : (
              <Table responsive size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-3">Train</th>
                    <th scope="col">Class</th>
                    <th scope="col" className="text-end">Berths</th>
                    <th scope="col" className="text-end">Confirmed</th>
                    <th scope="col" style={{ minWidth: 160 }}>Occupancy</th>
                    <th scope="col" className="text-end">Revenue</th>
                    <th scope="col" className="text-end">Cancelled</th>
                    <th scope="col" className="text-end pe-3">Waitlisted</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byClass.map((r) => (
                    <tr key={`${r.trainNumber}-${r.seatType}`}>
                      <td className="ps-3">
                        {r.trainNumber} <span className="text-secondary small">{r.trainName}</span>
                      </td>
                      <td>{SEAT_TYPES.find((x) => x.id === r.seatType)?.short || r.seatType}</td>
                      <td className="text-end">{r.seats.toLocaleString('en-IN')}</td>
                      <td className="text-end">{r.confirmed.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="occupancy-track" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, r.occupancyPct)}%` }} />
                          </div>
                          <span className="small">{r.occupancyPct}%</span>
                        </div>
                      </td>
                      <td className="text-end">{rupees(r.revenue)}</td>
                      <td className="text-end">{r.cancelled}</td>
                      <td className="text-end pe-3">{r.waitlisted}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <h2 className="h6 mb-0">Day by day</h2>
            </Card.Header>
            {report.byDay.length === 0 ? (
              <Card.Body className="small text-secondary">No bookings for journeys in this period.</Card.Body>
            ) : (
              <Table responsive size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-3">Journey date</th>
                    <th scope="col" className="text-end">Bookings</th>
                    <th scope="col" className="text-end">Passengers</th>
                    <th scope="col" className="text-end">Revenue</th>
                    <th scope="col" className="text-end">Cancelled</th>
                    <th scope="col" className="text-end">Waitlisted</th>
                    <th scope="col" className="text-end">Got a seat</th>
                    <th scope="col" className="text-end pe-3">Not confirmed at chart</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDay.map((d) => (
                    <tr key={d.date}>
                      <td className="ps-3">{new Date(d.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="text-end">{d.bookings}</td>
                      <td className="text-end">{d.passengers}</td>
                      <td className="text-end">{rupees(d.revenue)}</td>
                      <td className="text-end">{d.cancelled}</td>
                      <td className="text-end">{d.waitlisted}</td>
                      <td className="text-end">{d.confirmedFromWaitlist}</td>
                      <td className="text-end pe-3">{d.notConfirmedAtChart}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
