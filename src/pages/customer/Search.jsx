import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { customerApi, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { Button, todayIso } from '../../components/ui.jsx';
import SearchCard from '../../components/SearchCard.jsx';
import { describeJourney, TIME_SLOTS } from '../../journey.js';
import { resultsUrl, saveLastSearch } from './Home.jsx';
import TrainCard from './TrainCard.jsx';

const SORTS = [
  { id: 'dep', label: 'Departure' },
  { id: 'dur', label: 'Duration' },
  { id: 'arr', label: 'Arrival' },
];

/** Results page: modify-search bar, filters on the left, trains on the right */
export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, askLogin } = useSession();
  const { busy, run } = useAction();
  const [noTrainsReason, setNoTrainsReason] = useState('');

  const q = {
    from: params.get('from') || '',
    to: params.get('to') || '',
    date: params.get('date') || todayIso(),
    cls: params.get('cls') || '',
    quota: params.get('quota') || 'GN',
    fl: params.get('fl') || '',
    tl: params.get('tl') || '',
  };
  const key = `${q.from}|${q.to}|${q.date}`;

  const [trains, setTrains] = useState(null);
  const [classFilter, setClassFilter] = useState(q.cls ? [q.cls] : []);
  const [typeFilter, setTypeFilter] = useState([]);
  const [depFilter, setDepFilter] = useState([]);
  const [sort, setSort] = useState('dep');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    if (!q.from || !q.to) return;
    if (session?.role !== 'customer') {
      askLogin('Log in to see trains for this route.', null);
      return;
    }
    setTrains(null);
    setNoTrainsReason('');
    run(async () => {
      try {
        const res = await customerApi.trains(session.token, { from: q.from, to: q.to, date: q.date });
        setTrains((res.data2 || []).filter((m) => m && m.train && typeof m.train === 'object'));
      } catch (err) {
        // "No matching trains/stations" is an empty result, not an error
        if (err.status === 404 && !err.unexpected && !/customer|account/i.test(err.message)) {
          setTrains([]);
          setNoTrainsReason(err.message);
          return;
        }
        throw err;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session?.token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setClassFilter(q.cls ? [q.cls] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.cls]);

  const modify = (next) => {
    saveLastSearch(next);
    navigate(resultsUrl(next));
  };

  const journeys = useMemo(
    () =>
      (trains || []).map((m) => ({
        train: m.train,
        match: m,
        j: describeJourney(m.train, m.fromStation, m.toStation, q.date, m.fromStop, m.toStop),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trains, key]
  );

  const types = [...new Set(journeys.map(({ train }) => train.train_type).filter(Boolean))];

  const shown = journeys
    .filter(({ j }) => !classFilter.length || j.classes.some((c) => classFilter.includes(c.id)))
    .filter(({ train }) => !typeFilter.length || typeFilter.includes(train.train_type))
    .filter(({ j }) => {
      if (!depFilter.length || j.depMin == null) return true;
      return TIME_SLOTS.some((s) => depFilter.includes(s.id) && j.depMin >= s.from && j.depMin < s.to);
    })
    .sort((a, b) => {
      const k = sort === 'dur' ? 'durationMin' : sort === 'arr' ? 'arrMin' : 'depMin';
      return (a.j[k] ?? 9999) - (b.j[k] ?? 9999);
    });

  const toggle = (list, set) => (id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const filtersOn = classFilter.length + typeFilter.length + depFilter.length;

  const niceDate = new Date(q.date + 'T00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const clearFilters = () => {
    setClassFilter([]);
    setTypeFilter([]);
    setDepFilter([]);
  };

  const checkGroup = (legend, items, list, set) => (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-bold text-dark mb-2">{legend}</legend>
      {items.map((it) => (
        <Form.Check
          key={it.id}
          id={`f-${legend}-${it.id}`}
          type="checkbox"
          label={it.label}
          checked={list.includes(it.id)}
          onChange={() => toggle(list, set)(it.id)}
        />
      ))}
    </fieldset>
  );

  return (
    <>
      <div className="modify-bar py-3">
        <div className="container">
          <SearchCard key={key + q.cls + q.quota} initial={q} onSearch={modify} variant="bar" busy={busy} />
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <aside className={`col-lg-3 ${showFilters ? '' : 'd-none d-lg-block'}`} aria-label="Filters">
            <Card className="filters shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-baseline border-bottom pb-2 mb-3">
                  <h2 className="h6 mb-0">
                    <i className="bi bi-funnel me-1" aria-hidden="true" />
                    Refine results
                  </h2>
                  {filtersOn > 0 && (
                    <button className="btn btn-link btn-sm p-0" onClick={clearFilters}>
                      Reset
                    </button>
                  )}
                </div>
                {checkGroup(
                  'Journey class',
                  SEAT_TYPES.map((t) => ({ id: t.id, label: `${t.label} (${t.short})` })),
                  classFilter,
                  setClassFilter
                )}
                {types.length > 0 &&
                  checkGroup(
                    'Train type',
                    types.map((t) => ({ id: t, label: t })),
                    typeFilter,
                    setTypeFilter
                  )}
                {checkGroup('Departure time', TIME_SLOTS, depFilter, setDepFilter)}
              </Card.Body>
            </Card>
          </aside>

          <section className="col-lg-9 vstack gap-3" aria-live="polite">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h1 className="h5 mb-0">
                {trains ? `${shown.length} ${shown.length === 1 ? 'train' : 'trains'}` : 'Trains'} from {q.fl || q.from} to {q.tl || q.to}
                <span className="d-block d-sm-inline ms-sm-2 fs-6 fw-normal text-secondary">{niceDate}</span>
              </h1>
              <div className="d-flex align-items-center gap-2">
                <Button variant="outline" size="sm" className="d-lg-none" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                  <i className="bi bi-funnel" aria-hidden="true" />
                  Filters{filtersOn ? ` (${filtersOn})` : ''}
                </Button>
                <span className="small text-secondary d-none d-sm-inline">Sort by</span>
                <div className="btn-group btn-group-sm" role="group" aria-label="Sort by">
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`btn ${sort === s.id ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setSort(s.id)}
                      aria-pressed={sort === s.id}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {busy && (
              <div className="vstack gap-3" role="status" aria-label="Looking for trains">
                {[0, 1, 2].map((i) => (
                  <Card className="shadow-sm placeholder-glow" key={i} aria-hidden="true">
                    <Card.Header className="bg-primary-subtle">
                      <span className="placeholder col-4" /> <span className="placeholder col-2" />
                    </Card.Header>
                    <Card.Body>
                      <div className="d-flex justify-content-between mb-3">
                        <span className="placeholder placeholder-lg col-2" />
                        <span className="placeholder col-2" />
                        <span className="placeholder placeholder-lg col-2" />
                      </div>
                      <div className="d-flex gap-2">
                        {[0, 1, 2, 3].map((j) => (
                          <span className="placeholder rounded col" style={{ height: 52 }} key={j} />
                        ))}
                      </div>
                    </Card.Body>
                  </Card>
                ))}
                <span className="visually-hidden">Looking for trains…</span>
              </div>
            )}

            {session?.role !== 'customer' && (
              <Card body className="text-center py-4">
                <p className="text-secondary">Log in to see trains for this route.</p>
                <Button variant="accent" onClick={() => askLogin('Log in to see trains for this route.', null)}>
                  Log in
                </Button>
              </Card>
            )}

            {trains && shown.length === 0 && (
              <Card body className="text-center py-4">
                <i className="bi bi-train-front fs-1 text-secondary" aria-hidden="true" />
                <p className="text-secondary mt-2">
                  {trains.length === 0
                    ? noTrainsReason || 'No trains run between these stations on that date. Try another date.'
                    : 'No trains match these filters.'}
                </p>
                {filtersOn > 0 && trains.length > 0 && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </Card>
            )}

            {shown.map(({ train, j, match }) => (
              <TrainCard
                key={`${train.trainNumber}-${q.quota}`}
                train={train}
                journey={j}
                date={q.date}
                from={match.fromStation}
                to={match.toStation}
                preferredClass={q.cls}
                quota={q.quota}
              />
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
