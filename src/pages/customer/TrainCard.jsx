import { useState } from 'react';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import { Button, rupees } from '../../components/ui.jsx';
import { durationLabel, formatDay } from '../../journey.js';
import RouteStrip from './RouteStrip.jsx';
import BookingPanel from './BookingPanel.jsx';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TrainCard({ train, journey: j, date, from, to, preferredClass }) {
  const { session } = useSession();
  const { busy, run } = useAction();
  const [availability, setAvailability] = useState({}); // seat type id → { available, waitlisted, fare, status, berthPreferences }
  const [checking, setChecking] = useState('');
  const [selected, setSelected] = useState(() => j.classes.find((c) => c.id === preferredClass)?.id || '');
  const [booking, setBooking] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  const boardName = j.board?.stationName || from;
  const alightName = j.alight?.stationName || to;

  const check = (cls) =>
    run(async () => {
      setChecking(cls.id);
      try {
        const res = await customerApi.selectClass(session.token, {
          trainNo: train.trainNumber,
          start: boardName,
          end: alightName,
          seatType: cls.id,
          date,
        });
        setAvailability((a) => ({ ...a, [cls.id]: res.data2 }));
      } finally {
        setChecking('');
      }
    });

  const pick = (cls) => {
    setSelected(cls.id);
    setBooking(false);
    if (availability[cls.id] === undefined) check(cls);
  };

  const cls = j.classes.find((c) => c.id === selected);
  const info = cls ? availability[cls.id] : undefined;
  const canBook = info && info.status !== 'REGRET';

  return (
    <Card as="article" className="tc shadow-sm">
      <Card.Header className="py-2">
        <h2 className="tc-name">
          {train.trainName} <span className="text-secondary">({train.trainNumber})</span>
        </h2>
        {train.train_type && <Badge bg="primary-subtle" text="primary" className="fw-semibold">{train.train_type}</Badge>}
        {j.knowsRunningDays && (
          <span className="tc-runs" aria-label={`Runs on ${DAY_NAMES.filter((_, i) => j.runs[i]).join(', ')}`}>
            Runs on
            {DAY_LETTERS.map((d, i) => (
              <b key={i} className={j.runs[i] ? 'on' : ''} aria-hidden="true">
                {d}
              </b>
            ))}
          </span>
        )}
        <button className="btn btn-link btn-sm ms-md-auto p-0" onClick={() => setShowRoute((v) => !v)} aria-expanded={showRoute}>
          <i className={`bi ${showRoute ? 'bi-chevron-up' : 'bi-signpost-split'} me-1`} aria-hidden="true" />
          {showRoute ? 'Hide schedule' : 'Train schedule'}
        </button>
      </Card.Header>

      <Card.Body className="pb-2">
        <div className="tc-times mb-3">
          <div className="tc-point">
            <strong>{j.depTime}</strong>
            <span className="tc-station">{boardName}</span>
            <span>{formatDay(j.depDate)}</span>
          </div>
          <div className="tc-dur">
            <span>{durationLabel(j.durationMin)}</span>
            {j.distance ? <small>{Math.round(j.distance)} km</small> : null}
          </div>
          <div className="tc-point end">
            <strong>{j.arrTime}</strong>
            <span className="tc-station">{alightName}</span>
            <span>{formatDay(j.arrDate)}</span>
          </div>
        </div>

        {showRoute && j.stations.length > 1 && (
          <div className="border-top">
            <RouteStrip stations={j.stations} from={j.si} to={j.ei} />
          </div>
        )}

        <div className="class-tiles d-flex flex-wrap gap-2 pb-2" role="group" aria-label="Classes">
          {j.classes.length === 0 && <p className="text-secondary small mb-0">Seat classes haven’t been set up for this train yet.</p>}
          {j.classes.map((c) => {
            const a = availability[c.id];
            const tone = !a ? '' : a.available > 0 ? 'ok' : a.status === 'REGRET' ? 'no' : 'wl';
            return (
              <button key={c.id} type="button" className={`class-tile ${selected === c.id ? 'is-selected' : ''}`} onClick={() => pick(c)} aria-pressed={selected === c.id}>
                <span className="ct-name">
                  {c.label} ({c.short})
                </span>
                {checking === c.id ? (
                  <span className="small text-primary d-inline-flex align-items-center gap-1">
                    <Spinner animation="border" size="sm" aria-hidden="true" /> Checking…
                  </span>
                ) : a === undefined ? (
                  <span className="ct-check">Check availability</span>
                ) : (
                  <span className={`ct-status ${tone}`}>{a.status}</span>
                )}
                {a && <span className="ct-fare">{rupees(a.fare)}</span>}
              </button>
            );
          })}
        </div>
      </Card.Body>

      {cls && (
        <Card.Footer className="bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            {info ? (
              <>
                <strong className="fs-5 me-2">{rupees(info.fare)}</strong>
                <span className="small text-secondary">
                  per passenger, {cls.label}
                  {info.available === 0 && info.status !== 'REGRET' ? '. You’ll join the waitlist.' : ''}
                </span>
              </>
            ) : (
              <span className="small text-secondary">Check {cls.label} to see seats and fare.</span>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline" busy={busy && checking === cls.id} busyText="Checking…" onClick={() => check(cls)}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              {info ? 'Refresh' : 'Check availability'}
            </Button>
            <Button variant="accent" disabled={!canBook} onClick={() => setBooking(true)}>
              {info && info.available === 0 ? 'Book on waitlist' : 'Book now'}
            </Button>
          </div>
        </Card.Footer>
      )}

      {booking && cls && (
        <BookingPanel
          train={train}
          seatClass={cls}
          availability={info}
          onBooked={() => check(cls)}
          date={date}
          from={boardName}
          to={alightName}
          onClose={() => setBooking(false)}
        />
      )}
    </Card>
  );
}
