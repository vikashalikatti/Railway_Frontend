import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button } from '../../components/ui.jsx';
import useConfirm from '../../components/useConfirm.jsx';
import { fromServer, STEPS } from './trainStore.js';
import TrainBuilder from './TrainBuilder.jsx';

/** Admin home: every train in the database on the left, its setup steps on the right */
export default function AdminDashboard() {
  const { session, notify } = useSession();
  const load = useAction();
  const del = useAction();
  const [confirm, confirmDialog] = useConfirm();
  const [trains, setTrains] = useState(null); // null while loading
  const [total, setTotal] = useState(0); // trains matching the search on the server
  const [selected, setSelected] = useState(null); // train number, or 'new'
  const [current, setCurrent] = useState(null); // the selected train (kept even when a search hides it)
  const [query, setQuery] = useState('');
  const timer = useRef(null);

  const reload = useCallback(
    (q = '', quiet = false) =>
      load.run(async () => {
        const res = await adminApi.trains(session.token, q, 50, quiet);
        const list = (res.data2 || []).filter((t) => t && typeof t === 'object').map((t) => fromServer(t));
        setTrains(list);
        setTotal(Number(res.data) || list.length);
        setSelected((sel) => (sel === null ? list[0]?.trainNumber ?? 'new' : sel));
        setCurrent((cur) => {
          if (cur) return list.find((t) => t.trainNumber === cur.trainNumber) || cur;
          return list[0] || null;
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.token]
  );

  useEffect(() => {
    reload('');
    return () => clearTimeout(timer.current);
  }, [reload]);

  // Search on the server as the admin types (there can be thousands of trains)
  const onSearch = (v) => {
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reload(v.trim(), true), 300);
  };

  const pick = (t) => {
    setSelected(t.trainNumber);
    setCurrent(t);
  };

  /** A setup step was saved: show it at once, then refresh from the server */
  const upsert = (train) => {
    setTrains((list) => {
      const rest = (list || []).filter((t) => t.trainNumber !== train.trainNumber);
      return [...rest, train].sort((a, b) => a.trainNumber - b.trainNumber);
    });
    pick(train);
    reload(query.trim(), true);
  };

  const remove = async (train) => {
    const ok = await confirm({
      title: `Delete train ${train.trainNumber}?`,
      body: `${train.trainName} and its schedule, stops, fares and coaches will be deleted. Trains that have bookings can’t be deleted.`,
      confirmLabel: 'Delete train',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    del.run(async () => {
      try {
        await adminApi.deleteTrain(session.token, train.trainNumber);
        notify(`Train ${train.trainNumber} deleted.`, 'success');
      } catch (err) {
        if (err.status !== 404) throw err; // already gone: just refresh the list
        notify(`Train ${train.trainNumber} was already deleted. The list has been refreshed.`, 'info');
      }
      setSelected(null);
      setCurrent(null);
      await reload(query.trim());
    });
  };

  const q = query.trim();
  const shown = trains;

  return (
    <div className="container py-4">
      {confirmDialog}
      <div className="row g-4">
        <aside className="col-lg-4 col-xl-3">
          <Card className="shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center bg-white">
              <h1 className="h5 mb-0">
                <i className="bi bi-train-front me-2 text-accent" aria-hidden="true" />
                Trains
              </h1>
              <Button variant="outline" size="sm" onClick={() => reload(q)} busy={load.busy} aria-label="Refresh list" title="Refresh list">
                {!load.busy && <i className="bi bi-arrow-clockwise" aria-hidden="true" />}
              </Button>
            </Card.Header>
            <div className="p-2 border-bottom d-grid gap-2">
              <Button variant={selected === 'new' ? 'primary' : 'outline'} size="sm" onClick={() => setSelected('new')} aria-pressed={selected === 'new'}>
                <i className="bi bi-plus-lg" aria-hidden="true" />
                Add a train
              </Button>
              <Link to="/console/import" className="btn btn-outline-primary btn-sm">
                <i className="bi bi-cloud-arrow-down me-1" aria-hidden="true" />
                Import trains
              </Link>
              {(trains?.length > 0 || q) && (
                <div className="position-relative">
                  <i className="bi bi-search train-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    className="form-control form-control-sm train-search"
                    placeholder="Number, name or first/last station"
                    aria-label="Search trains by number, name, first or last station"
                    value={query}
                    maxLength={60}
                    onChange={(e) => onSearch(e.target.value)}
                  />
                </div>
              )}
              {shown && (q || total > shown.length) && (
                <span className="small text-secondary px-1" role="status">
                  {total > shown.length
                    ? `Showing ${shown.length} of ${total.toLocaleString('en-IN')} trains. Search to find the rest.`
                    : `${total} ${total === 1 ? 'train' : 'trains'}`}
                </span>
              )}
            </div>

            {trains === null ? (
              <ListGroup variant="flush" className="placeholder-glow" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <ListGroup.Item key={i}>
                    <span className="placeholder col-3 me-2" />
                    <span className="placeholder col-6" />
                    <span className="placeholder col-8 d-block mt-2" />
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : trains.length === 0 && !q ? (
              <Card.Body className="text-secondary small">
                No trains yet. Add one to set up its timetable, fares and coaches, or import many at once.
              </Card.Body>
            ) : shown.length === 0 ? (
              <Card.Body className="text-secondary small">
                No train matches “{query.trim()}”.{' '}
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onSearch('')}>
                  Clear search
                </button>
              </Card.Body>
            ) : (
              <ListGroup variant="flush" className="train-list">
                {shown.map((t) => {
                  const doneCount = STEPS.filter((s) => t.done?.[s]).length;
                  const active = selected === t.trainNumber;
                  return (
                    <ListGroup.Item key={t.trainNumber} action active={active} onClick={() => pick(t)} className="fleet-item">
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg={active ? 'light' : 'primary'} text={active ? 'primary' : undefined}>
                          {t.trainNumber}
                        </Badge>
                        <span className="fw-bold text-truncate">{t.trainName}</span>
                      </div>
                      <div className="small opacity-75">
                        {t.sourceStation} to {t.destinationStation}
                      </div>
                      <div className="progress-dots" aria-label={`${doneCount} of ${STEPS.length} setup steps done`}>
                        {STEPS.map((s) => (
                          <i key={s} className={t.done?.[s] ? 'on' : ''} />
                        ))}
                      </div>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            )}
          </Card>
        </aside>

        <section className="col-lg-8 col-xl-9 vstack gap-3">
          {trains === null ? null : selected === 'new' || !current ? (
            <TrainBuilder key="new" train={null} onChange={upsert} takenNumbers={trains.map((t) => t.trainNumber)} />
          ) : (
            <>
              <TrainBuilder key={current.trainNumber} train={current} onChange={upsert} />
              <div>
                <Button variant="danger" busy={del.busy} busyText="Deleting…" onClick={() => remove(current)}>
                  <i className="bi bi-trash" aria-hidden="true" />
                  Delete train {current.trainNumber}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
