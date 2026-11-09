import { Link } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import { describeJourney, durationLabel } from '../../journey.js';
import { resultsUrl } from './Home.jsx';

/**
 * Journeys with one change, shown when no train runs all the way.
 * Each leg links to the normal results page for that stretch, where it can be booked.
 */
export default function Connections({ connections, date, quota }) {
  if (!connections?.length) return null;
  const legInfo = (m) => {
    const j = describeJourney(m.train, m.fromStation, m.toStation, date, m.fromStop, m.toStop);
    return { ...m, j };
  };
  return (
    <section className="vstack gap-3" aria-label="Journeys with one change">
      <h2 className="h6 mb-0">
        <i className="bi bi-shuffle me-2 text-accent" aria-hidden="true" />
        No direct train. These journeys have one change:
      </h2>
      {connections.map((c, i) => {
        const a = legInfo(c.first);
        const b = legInfo(c.second);
        const total = a.j.depMin != null && b.j.arrMin != null ? b.j.arrMin - a.j.depMin : null;
        return (
          <Card key={i} className="shadow-sm">
            <Card.Body className="vstack gap-2">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <strong>
                  {a.fromStation} {a.j.depTime} → {b.toStation} {b.j.arrTime}
                </strong>
                <span className="small text-secondary">
                  {total != null && total > 0 ? `${durationLabel(total)} in all, ` : ''}change at {c.via}, wait {durationLabel(c.layoverMinutes)}
                </span>
              </div>
              {[a, b].map((leg, k) => (
                <div key={k} className="connection-leg d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <span className="badge text-bg-primary me-2">{leg.train.trainNumber}</span>
                    <span className="fw-semibold">{leg.train.trainName}</span>
                    <div className="small text-secondary">
                      {leg.fromStation} {leg.j.depTime} to {leg.toStation} {leg.j.arrTime}
                    </div>
                  </div>
                  <Link
                    className="btn btn-sm btn-outline-primary"
                    to={resultsUrl({ from: leg.fromStation, to: leg.toStation, date, quota })}
                  >
                    Book {k === 0 ? 'first' : 'second'} train
                  </Link>
                </div>
              ))}
            </Card.Body>
          </Card>
        );
      })}
      <p className="small text-secondary mb-0">Book each train separately. Allow for delays when you choose a change with a short wait.</p>
    </section>
  );
}
