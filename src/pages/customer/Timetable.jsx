import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { customerApi } from '../../api.js';
import { useAction } from '../../session.jsx';

/** Public timetable: type a train number or name, see every stop with times, day, halt and km */
export default function Timetable() {
  const [params, setParams] = useSearchParams();
  const load = useAction();
  const [text, setText] = useState(params.get('train') || '');
  const [options, setOptions] = useState([]);
  const [tt, setTt] = useState(null);
  const timer = useRef(null);

  const show = (no) => {
    if (!/^\d{1,5}$/.test(String(no))) return;
    setParams({ train: String(no) }, { replace: true });
    setOptions([]);
    load.run(async () => setTt((await customerApi.timetable(no)).data2));
  };

  useEffect(() => {
    const no = params.get('train');
    if (no) show(no);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onType = (v) => {
    setText(v);
    clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(() => {
      customerApi
        .findTrains(v.trim())
        .then((r) => setOptions(r.data2 || []))
        .catch(() => setOptions([]));
    }, 250);
  };

  return (
    <div className="container py-4 vstack gap-4" style={{ maxWidth: 960 }}>
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-calendar-week text-accent me-2" aria-hidden="true" />
            Train timetable
          </h1>
          <p className="text-secondary mb-3">Every stop of a train, with arrival and departure times, the day of the journey, halts and distance.</p>
          <form
            className="position-relative"
            onSubmit={(e) => {
              e.preventDefault();
              const no = text.trim().match(/^\d{1,5}/)?.[0] || options[0]?.trainNumber;
              if (no) show(no);
            }}
          >
            <label htmlFor="tt-train" className="form-label">
              Train number or name
            </label>
            <div className="d-flex gap-2">
              <input
                id="tt-train"
                className="form-control"
                type="search"
                autoComplete="off"
                maxLength={60}
                placeholder="e.g. 12627 or Karnataka"
                value={text}
                onChange={(e) => onType(e.target.value)}
              />
              <button type="submit" className="btn btn-accent" disabled={load.busy}>
                Show
              </button>
            </div>
            {options.length > 0 && (
              <ul className="train-picker list-unstyled" role="listbox" aria-label="Matching trains">
                {options.map((t) => (
                  <li
                    key={t.trainNumber}
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setText(`${t.trainNumber} ${t.trainName}`);
                      show(t.trainNumber);
                    }}
                  >
                    <strong>{t.trainNumber}</strong> {t.trainName}
                    <span className="d-block small text-secondary">
                      {t.from} to {t.to}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </Card.Body>
      </Card>

      {tt && (
        <Card className="shadow-sm">
          <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h2 className="h5 mb-0">
              {tt.trainNumber} {tt.trainName}
              {tt.type && <span className="badge text-bg-light border ms-2 align-middle fw-normal">{tt.type}</span>}
            </h2>
            <span className="small text-secondary">
              {tt.totalKm} km, {tt.duration}
              {tt.runningDays.length === 7 ? ', runs daily' : tt.runningDays.length ? `, runs ${tt.runningDays.join(' ')}` : ''}
              {tt.classes.length ? `, classes ${tt.classes.join(' ')}` : ''}
            </span>
          </Card.Header>
          <Table responsive hover size="sm" className="mb-0 align-middle timetable">
            <thead className="table-light">
              <tr>
                <th scope="col" className="ps-3">#</th>
                <th scope="col">Station</th>
                <th scope="col">Arrives</th>
                <th scope="col">Departs</th>
                <th scope="col">Halt</th>
                <th scope="col">Day</th>
                <th scope="col" className="pe-3 text-end">km</th>
              </tr>
            </thead>
            <tbody>
              {tt.stops.map((s, i) => (
                <tr key={s.no} className={i > 0 && s.day !== tt.stops[i - 1].day ? 'new-day' : ''}>
                  <td className="ps-3 text-secondary">{s.no}</td>
                  <td>
                    {s.station} {s.code && <span className="text-secondary">({s.code})</span>}
                  </td>
                  <td>{s.arrives || 'Starts'}</td>
                  <td>{s.departs || 'Ends'}</td>
                  <td>{s.halt ? `${s.halt} min` : ''}</td>
                  <td>{s.day}</td>
                  <td className="pe-3 text-end">{s.km}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
