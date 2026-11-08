import { useNavigate } from 'react-router-dom';
import { useSession } from '../../session.jsx';
import SearchCard from '../../components/SearchCard.jsx';

const LAST_SEARCH = 'railway.lastSearch';

export function loadLastSearch() {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_SEARCH)) || {};
  } catch {
    return {};
  }
}

export function saveLastSearch(q) {
  try {
    sessionStorage.setItem(LAST_SEARCH, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export function resultsUrl(q) {
  const p = new URLSearchParams({ from: q.from, to: q.to, date: q.date });
  if (q.cls) p.set('cls', q.cls);
  if (q.quota && q.quota !== 'GN') p.set('quota', q.quota);
  // labels shown in the boxes, when they differ from what is searched (e.g. "KSR Bengaluru City Jn" for SBC)
  if (q.fl && q.fl !== q.from) p.set('fl', q.fl);
  if (q.tl && q.tl !== q.to) p.set('tl', q.tl);
  return `/trains?${p}`;
}

export default function Home() {
  const navigate = useNavigate();
  const { session, askLogin } = useSession();

  const search = (q) => {
    saveLastSearch(q);
    const go = () => navigate(resultsUrl(q));
    // The search endpoint needs a logged-in passenger
    if (session?.role === 'customer') go();
    else askLogin('Log in to search trains. Your search is kept.', go);
  };

  const help = [
    {
      icon: 'bi-geo-alt',
      title: 'Search by station',
      text: 'Type the boarding and destination stations as they appear on the timetable, and pick your travel date.',
    },
    {
      icon: 'bi-grid-3x3-gap',
      title: 'See seats in every class',
      text: 'Each class shows seats left for your stretch of the route, or your waitlist number, with the fare.',
    },
    {
      icon: 'bi-ticket-perforated',
      title: 'Book up to six passengers',
      text: 'Pick berth preferences. Passengers aged 60+ get a lower berth when one is free, and groups sit together.',
    },
  ];

  return (
    <>
      <section className="hero">
        <div className="container py-4 py-lg-5">
          <div className="row g-4 align-items-center">
            <div className="col-lg-5 order-2 order-lg-1">
              <SearchCard initial={loadLastSearch()} onSearch={search} />
            </div>
            <div className="col-lg-7 order-1 order-lg-2 ps-lg-5">
              <p className="hero-line mb-3">Every train on your route, with seats and fares for each class.</p>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge rounded-pill text-bg-light fw-semibold px-3 py-2">
                  <i className="bi bi-shield-check me-1" aria-hidden="true" />
                  No double bookings
                </span>
                <span className="badge rounded-pill text-bg-light fw-semibold px-3 py-2">
                  <i className="bi bi-hourglass-split me-1" aria-hidden="true" />
                  Automatic waitlist
                </span>
                <span className="badge rounded-pill text-bg-light fw-semibold px-3 py-2">
                  <i className="bi bi-envelope-check me-1" aria-hidden="true" />
                  Email OTP sign-in
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-track" aria-hidden="true" />
      </section>

      <section className="container py-5">
        <div className="row g-4">
          {help.map((h) => (
            <div className="col-md-4 help-item" key={h.title}>
              <div className="d-flex gap-3">
                <span className="flex-shrink-0 rounded-3 bg-primary-subtle text-primary d-grid" style={{ width: 44, height: 44, placeItems: 'center' }}>
                  <i className={`bi ${h.icon} fs-5`} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="mb-1">{h.title}</h2>
                  <p className="text-secondary mb-0">{h.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
