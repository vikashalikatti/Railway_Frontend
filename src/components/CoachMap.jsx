import { BERTH_SHORT, berthTypeOf, coachUnits, isBerthClass, LAYOUT_NAMES } from '../coachLayout.js';

/**
 * One coach drawn like the real thing, front to back: compartments of facing berths with the
 * side berths across the aisle (sleeper classes), cabins with a corridor (AC first class), or rows
 * of seats either side of the aisle (chair cars and second sitting).
 *
 * tile(seatNumber, berthType) -> { state, title } decides each seat's colour (state is a CSS
 * class: vacant, partly, booked, mine, plain) and its tooltip.
 */
export default function CoachMap({ coachNumber, seatType, seats, tile, caption }) {
  const units = coachUnits(seatType, seats);
  const berths = isBerthClass(seatType);

  const Seat = ({ n }) => {
    const type = berthTypeOf(seatType, n);
    const { state = 'plain', title = '' } = tile(n, type) || {};
    const label = `${coachNumber} ${n} ${BERTH_SHORT[type] || ''}${title ? `: ${title}` : ''}`;
    return (
      <span className={`berth ${state}`} title={label} aria-label={label} tabIndex={0} role="img">
        <b>{n}</b>
        <small>{BERTH_SHORT[type]}</small>
      </span>
    );
  };

  const part = (rows, cls) => (
    <div className={cls}>
      {rows.map((row, i) => (
        <div className="cu-row" key={i}>
          {row.map((n) => (
            <Seat key={n} n={n} />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <section className={`coach-map ${berths ? 'is-berths' : 'is-seats'}`} aria-label={`Coach ${coachNumber}`}>
      <header className="coach-head">
        <strong>{coachNumber}</strong>
        <span className="small text-secondary">{caption || LAYOUT_NAMES[seatType]}</span>
      </header>
      <div className="coach-body">
        <div className="coach-end" aria-hidden="true">
          <i className="bi bi-door-open" /> Door
          <span className="ms-auto">
            <i className="bi bi-droplet" /> Toilet
          </span>
        </div>
        {units.map((u) => (
          <div className={`coach-unit ${u.cabin ? 'is-cabin' : ''}`} key={u.no}>
            {part(u.left, 'cu-left')}
            <div className={u.cabin ? 'cu-corridor' : 'cu-aisle'} aria-hidden="true" />
            {u.right.length > 0 && part(u.right, 'cu-right')}
          </div>
        ))}
        <div className="coach-end" aria-hidden="true">
          <i className="bi bi-droplet" /> Toilet
          <span className="ms-auto">
            <i className="bi bi-door-open" /> Door
          </span>
        </div>
      </div>
    </section>
  );
}
