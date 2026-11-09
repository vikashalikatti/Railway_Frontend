import { useMemo, useState } from 'react';
import { SEAT_TYPES } from '../api.js';
import CoachMap from './CoachMap.jsx';

/** Parts of [from, to) not covered by the booked stretches */
export function freeStretches(booked, from, to) {
  const segs = [...booked].sort((a, b) => a.from - b.from);
  const free = [];
  let at = from;
  for (const s of segs) {
    if (s.to <= at || s.from >= to) continue;
    if (s.from > at) free.push({ from: at, to: Math.min(s.from, to) });
    at = Math.max(at, s.to);
    if (at >= to) break;
  }
  if (at < to) free.push({ from: at, to });
  return free;
}

/**
 * vacant: free for the whole stretch looked at; partly: free for part of it; booked: not free at all.
 * With a journey picked (from/to), "vacant" means free for that journey.
 */
export function berthState(booked, from, to) {
  const free = freeStretches(booked, from, to);
  if (free.length === 1 && free[0].from === from && free[0].to === to) return { state: 'vacant', free };
  if (free.length === 0) return { state: 'booked', free };
  return { state: 'partly', free };
}

/**
 * Coach-by-coach berth map for one train run. Never shows who is on a berth.
 * stops: station names in route order. journey: { from, to } stop positions, or null for the whole route.
 */
export default function ChartBoard({ view, journey }) {
  const classes = view.classes || [];
  const [tab, setTab] = useState(classes[0]?.seatType);
  const last = (view.stops?.length || 1) - 1;
  const from = journey ? journey.from : 0;
  const to = journey ? journey.to : last;
  const name = (i) => view.stops?.[i] ?? `stop ${i + 1}`;

  const cls = classes.find((c) => c.seatType === tab) || classes[0];

  // Vacant berths per class for the stretch being looked at
  const counts = useMemo(() => {
    const out = {};
    classes.forEach((c) => {
      let vacant = 0;
      let partly = 0;
      c.coaches.forEach((co) =>
        co.berths.forEach((b) => {
          const st = berthState(b.booked, from, to).state;
          if (st === 'vacant') vacant += 1;
          else if (st === 'partly') partly += 1;
        })
      );
      out[c.seatType] = { vacant, partly };
    });
    return out;
  }, [classes, from, to]);

  if (!cls) return <p className="text-secondary">This train has no coaches set up.</p>;

  return (
    <div className="chart-board vstack gap-3">
      <div className="d-flex flex-wrap gap-2" role="tablist" aria-label="Classes">
        {classes.map((c) => {
          const t = SEAT_TYPES.find((x) => x.id === c.seatType);
          const n = counts[c.seatType] || { vacant: 0 };
          return (
            <button
              key={c.seatType}
              type="button"
              role="tab"
              aria-selected={c.seatType === cls.seatType}
              className={`btn btn-sm rounded-pill ${c.seatType === cls.seatType ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setTab(c.seatType)}
            >
              {t ? `${t.label} (${t.short})` : c.seatType}
              <span className={`badge ms-2 ${n.vacant > 0 ? 'text-bg-success' : 'text-bg-secondary'}`}>{n.vacant} vacant</span>
            </button>
          );
        })}
      </div>

      <div className="chart-legend d-flex flex-wrap gap-3 small" aria-label="Colour key">
        <span>
          <i className="berth-key vacant" /> Vacant {journey ? 'for your journey' : 'all the way'}
        </span>
        <span>
          <i className="berth-key partly" /> Vacant for part of the route
        </span>
        <span>
          <i className="berth-key booked" /> Booked
        </span>
      </div>

      <p className="small text-secondary mb-0">
        {journey ? `${name(from)} to ${name(to)}: ` : 'Whole route: '}
        {counts[cls.seatType]?.vacant ?? 0} berths vacant, {counts[cls.seatType]?.partly ?? 0} vacant for part of the way. Hover or tap a
        berth to see where it’s free. Each coach is drawn front to back, with the aisle down the middle.
      </p>

      <div className="coach-grid">
        {cls.coaches.map((coach) => {
          const bySeat = Object.fromEntries(coach.berths.map((b) => [b.seatNumber, b]));
          const vacantHere = coach.berths.filter((b) => berthState(b.booked, from, to).state === 'vacant').length;
          return (
            <CoachMap
              key={coach.coachNumber}
              coachNumber={coach.coachNumber}
              seatType={cls.seatType}
              seats={coach.berths.length}
              caption={`${vacantHere} vacant`}
              tile={(n) => {
                const b = bySeat[n];
                if (!b) return { state: 'plain' };
                const { state, free } = berthState(b.booked, from, to);
                const title =
                  state === 'vacant'
                    ? `vacant ${journey ? 'for your journey' : 'for the whole route'}`
                    : state === 'booked'
                      ? 'booked'
                      : `vacant ${free.map((f) => `${name(f.from)} to ${name(f.to)}`).join(', ')}`;
                return { state, title };
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
