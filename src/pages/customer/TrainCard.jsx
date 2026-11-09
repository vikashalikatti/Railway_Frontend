import { useState } from 'react';
import { customerApi, quotaOf, quotaOffered } from '../../api.js';
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

/** Statuses that mean "can't book this right now" */
const BLOCKED = ['REGRET', 'NOT AVAILABLE', 'CHART PREPARED'];

export default function TrainCard({ train, journey: j, date, from, to, preferredClass, quota = 'GN' }) {
  const q = quotaOf(quota);
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
          quota,
        });
        setAvailability((a) => ({ ...a, [cls.id]: res.data2 }));
      } finally {
        setChecking('');
      }
    });

  const pick = (cls) => {
    if (!quotaOffered(quota, cls.id)) return;
    setSelected(cls.id);
    setBooking(false);
    if (availability[cls.id] === undefined) check(cls);
  };

  const cls = j.classes.find((c) => c.id === selected);
  const info = cls ? availability[cls.id] : undefined;
  const canBook = info && !info.note && !BLOCKED.includes(info.status);
  const willWait = info && info.available === 0 && !BLOCKED.includes(info.status);

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
            <span>
              {formatDay(j.depDate)}
              {j.boardDay > 1 && <span className="badge text-bg-light border ms-1">Day {j.boardDay} of the run</span>}
            </span>
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
            const offered = quotaOffered(quota, c.id);
            const tone = !a ? '' : a.available > 0 && !a.note ? 'ok' : BLOCKED.includes(a.status) || a.note ? 'no' : 'wl';
            return (
              <button
                key={c.id}
                type="button"
                className={`class-tile ${selected === c.id ? 'is-selected' : ''}`}
                onClick={() => pick(c)}
                aria-pressed={selected === c.id}
                disabled={!offered}
                title={offered ? undefined : `No ${q.label} quota in ${c.short}`}
              >
                <span className="ct-name">
                  {c.label} ({c.short})
                </span>
                {!offered ? (
                  <span className="ct-check text-secondary">No {q.label} quota</span>
                ) : checking === c.id ? (
                  <span className="small text-primary d-inline-flex align-items-center gap-1">
                    <Spinner animation="border" size="sm" aria-hidden="true" /> Checking…
                  </span>
                ) : a === undefined && j.available && j.available[c.id] != null && quota === 'GN' ? (
                  <span className={`ct-status ${j.available[c.id] > 0 ? 'ok' : 'wl'}`}>
                    {j.available[c.id] > 0 ? `${j.available[c.id]} free` : 'RAC / WL'}
                  </span>
                ) : a === undefined ? (
                  <span className="ct-check">Check availability</span>
                ) : (
                  <span className={`ct-status ${tone}`}>{a.status}</span>
                )}
                {a && <span className="ct-fare">{rupees(a.fare)}</span>}
                {a?.confirmChance && <span className="ct-chance">Chance: {a.confirmChance}</span>}
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
                  {quota !== 'GN' ? `, ${q.label} quota` : ''}
                  {quota === 'TQ' ? ' (includes the Tatkal charge)' : ''}
                  {quota === 'PT' ? ' (Premium Tatkal: the fare rises as seats sell)' : ''}
                  {willWait ? (info.status.startsWith('RAC') ? '. You’ll get RAC.' : '. You’ll join the waitlist.') : ''}
                </span>
                {info.note && (
                  <div className="small text-danger mt-1" role="status">
                    <i className="bi bi-info-circle me-1" aria-hidden="true" />
                    {info.note}
                  </div>
                )}
                {info.chartPrepared && !info.note && (
                  <div className="small text-secondary mt-1">
                    <i className="bi bi-clipboard-check me-1" aria-hidden="true" />
                    Chart prepared: only seats still free can be booked, without a waitlist.
                  </div>
                )}
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
              {willWait ? (info.status.startsWith('RAC') ? 'Book on RAC' : 'Book on waitlist') : 'Book now'}
            </Button>
          </div>
        </Card.Footer>
      )}

      {booking && cls && (
        <BookingPanel
          train={train}
          seatClass={cls}
          availability={info}
          quota={quota}
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
