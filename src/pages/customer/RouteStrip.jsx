import { useEffect, useRef } from 'react';
import { formatTime } from '../../components/ui.jsx';

/**
 * Every stop on the train's line, with the passenger's own stretch
 * (boarding → destination) drawn as the yellow platform-edge line.
 */
export default function RouteStrip({ stations, from, to }) {
  const ref = useRef(null);

  // On narrow screens the strip scrolls sideways; start it a little before the boarding stop
  useEffect(() => {
    const el = ref.current;
    if (!el || from < 0) return;
    const stop = el.children[from];
    if (stop) el.scrollLeft = Math.max(stop.offsetLeft - el.offsetLeft - 24, 0);
  }, [from]);

  return (
    <ol className="strip" ref={ref} aria-label="Stops on this train">
      {stations.map((s, i) => {
        const inTrip = from >= 0 && to > from && i >= from && i <= to;
        const segIn = from >= 0 && to > from && i > from && i <= to; // the line leading into this stop
        const endpoint = i === from || i === to;
        const time = i === from ? s.departureTime : i === to ? s.arrivalTime : s.departureTime || s.arrivalTime;
        return (
          <li
            key={s.stationId ?? i}
            className={`stop ${inTrip ? 'in-trip' : ''} ${segIn ? 'seg-in' : ''} ${endpoint ? 'endpoint' : ''}`}
          >
            <span className="stop-dot" aria-hidden="true" />
            <span className="stop-name">{s.stationName}</span>
            <span className="stop-time">{formatTime(time)}</span>
            {endpoint && <span className="visually-hidden">{i === from ? '(you board here)' : '(you get off here)'}</span>}
          </li>
        );
      })}
    </ol>
  );
}
