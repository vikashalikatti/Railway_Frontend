import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';
import { adminApi, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Note } from '../../components/ui.jsx';
import useConfirm from '../../components/useConfirm.jsx';

const CSV_TEMPLATE = [
  'train_number,train_name,train_type,running_days,classes,station_code,station_name,arrival,departure,km',
  '16591,Hampi Express,Express,daily,SL 3A 2A,UBL,,,18:30,0',
  '16591,,,,,GDG,,19:28,19:30,',
  '16591,,,,,HPT,,21:10,21:15,',
  '16591,,,,,MYS,,11:45,,',
  '22691,Rajdhani Express,Rajdhani,mon wed fri,3A 2A 1A,SBC,,,20:00,0',
  '22691,,,,,NZM,,05:55,,2365',
].join('\n');

const JSON_TEMPLATE = JSON.stringify(
  {
    stations: [{ code: 'KGI', name: 'Kengeri', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9176, longitude: 77.4838 }],
    trains: [
      {
        number: '16591',
        name: 'Hampi Express',
        type: 'Express',
        days: ['daily'],
        coaches: { SL: 6, '3A': 2, '2A': 1 },
        stops: [
          { code: 'UBL', departure: '18:30' },
          { code: 'GDG', arrival: '19:28', departure: '19:30' },
          { code: 'MYS', arrival: '11:45', km: 600 },
        ],
      },
    ],
  },
  null,
  2
);

const download = (name, text, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const ORDER = ['SL', '3A', '2A', '1A', '3E', 'CC', 'EC', '2S'];
const CLASSES = ORDER.map((s) => SEAT_TYPES.find((t) => t.short === s));
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

/** Bulk import of trains: the bundled Karnataka list, or a CSV / JSON file */
export default function AdminImport() {
  const { session, notify } = useSession();
  const [confirm, confirmDialog] = useConfirm();
  const summaryLoad = useAction();
  const start = useAction();
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(null);
  const [coaches, setCoaches] = useState({ SL: 4, '3A': 2, '2A': 1, '1A': 1, '3E': 0, CC: 3, EC: 1, '2S': 0 });
  const [addCoaches, setAddCoaches] = useState(true);
  const [baseFare, setBaseFare] = useState('0');
  const [only, setOnly] = useState('');
  const [limit, setLimit] = useState('');
  const [file, setFile] = useState(null);
  const poll = useRef(null);

  const options = () => ({
    coaches: Object.fromEntries(Object.entries(coaches).map(([k, v]) => [k, Number(v) || 0])),
    addCoaches,
    baseFare: Number(baseFare) || 0,
    onlyStations: only.trim(),
    limit: limit ? Number(limit) : null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await adminApi.importStatus(session.token);
      setStatus(res.data2);
      return res.data2;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while an import runs
  const watch = useCallback(() => {
    clearTimeout(poll.current);
    const tick = async () => {
      const s = await refresh();
      if (s?.state === 'RUNNING') poll.current = setTimeout(tick, 1500);
      else if (s && s.state !== 'IDLE') notify(s.message, s.state === 'DONE' ? 'success' : 'warning');
    };
    poll.current = setTimeout(tick, 1000);
  }, [refresh, notify]);

  useEffect(() => {
    summaryLoad.run(async () => setSummary((await adminApi.importSummary(session.token)).data2));
    refresh().then((s) => s?.state === 'RUNNING' && watch());
    return () => clearTimeout(poll.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status?.state === 'RUNNING';
  const coachTotal = Object.values(coaches).reduce((a, b) => a + (Number(b) || 0), 0);
  const optionProblem =
    Number(baseFare) < 0 || Number(baseFare) > 100000
      ? 'Enter a base fare between 0 and 100000.'
      : addCoaches && coachTotal === 0
        ? 'Choose at least one coach, or untick “Add coaches and seats”.'
        : '';

  const importBundled = async () => {
    const n = limit ? Math.min(Number(limit), summary?.trains || 0) : summary?.trains;
    const ok = await confirm({
      title: `Import ${only.trim() ? 'matching' : fmt(n)} trains?`,
      body: `Trains already in the database are skipped, never changed. ${
        addCoaches ? 'Each train gets the coaches you chose for the classes it has, with every seat. ' : 'Trains get no coaches, so they can’t be booked until you add some. '
      }This can take a few minutes; you can leave this page.`,
      confirmLabel: 'Start import',
      cancelLabel: 'Not now',
    });
    if (!ok) return;
    start.run(async () => {
      const res = await adminApi.importBundled(session.token, options());
      setStatus(res.data2);
      watch();
    });
  };

  const importFile = (e) => {
    e.preventDefault();
    if (!file) return;
    start.run(async () => {
      try {
        const res = await adminApi.importUpload(session.token, file, options());
        setStatus(res.data2);
        watch();
      } catch (err) {
        if (err.body?.data2) setStatus(err.body.data2); // shows the file's problems
        throw err;
      }
    });
  };

  const pct = status?.total ? Math.round((100 * status.done) / status.total) : 0;

  return (
    <div className="container py-4 vstack gap-4">
      {confirmDialog}
      <div>
        <Link to="/console" className="small">
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Trains
        </Link>
        <h1 className="h4 mt-2 mb-1">
          <i className="bi bi-cloud-arrow-down text-accent me-2" aria-hidden="true" />
          Import trains
        </h1>
        <p className="text-secondary mb-0">
          Add many trains at once, with their stops, timings, fares and coaches. Trains you already have are never changed.
        </p>
      </div>

      {status && status.state !== 'IDLE' && (
        <Card className="shadow-sm import-status" aria-live="polite">
          <Card.Body className="p-4 vstack gap-3">
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <h2 className="h6 mb-0">
                {running ? 'Importing…' : status.state === 'DONE' ? 'Import finished' : 'Import stopped'}
                <span className="text-secondary fw-normal"> {status.source}</span>
              </h2>
              <span className="small text-secondary">
                Started {status.startedAt}
                {status.finishedAt ? `, finished ${status.finishedAt}` : ''}
              </span>
            </div>
            <ProgressBar
              now={pct}
              label={`${pct}%`}
              animated={running}
              variant={status.state === 'FAILED' ? 'danger' : status.failed ? 'warning' : 'success'}
              aria-label={`${status.done} of ${status.total} trains processed`}
            />
            <dl className="import-counts mb-0">
              <div>
                <dt>Imported</dt>
                <dd>{fmt(status.imported)}</dd>
              </div>
              <div>
                <dt>Already there</dt>
                <dd>{fmt(status.skipped)}</dd>
              </div>
              <div>
                <dt>Couldn’t import</dt>
                <dd className={status.failed ? 'text-danger' : ''}>{fmt(status.failed)}</dd>
              </div>
              <div>
                <dt>New stations</dt>
                <dd>{fmt(status.stationsAdded)}</dd>
              </div>
              <div>
                <dt>Seats created</dt>
                <dd>{fmt(status.seats)}</dd>
              </div>
            </dl>
            <p className="mb-0">{status.message}</p>
            {status.problems?.length > 0 && (
              <details>
                <summary className="small">
                  {status.problems.length} {status.problems.length === 1 ? 'problem' : 'problems'}
                  {status.problems.length >= 50 ? ' (first 50)' : ''}
                </summary>
                <ul className="small mb-0 mt-2 import-problems">
                  {status.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="shadow-sm">
        <Card.Body className="p-4 vstack gap-3">
          <h2 className="h5 mb-0">For every imported train</h2>
          <p className="text-secondary small mb-0">
            Coaches per class are used for the classes each train has. A file can give its own coach numbers per train instead.
          </p>
          <label className="form-check mb-0">
            <input className="form-check-input" type="checkbox" checked={addCoaches} onChange={(e) => setAddCoaches(e.target.checked)} />
            <span className="form-check-label">Add coaches and seats (needed before a train can be booked)</span>
          </label>
          {addCoaches && (
            <fieldset>
              <legend className="small fw-semibold mb-2">Coaches per class</legend>
              <div className="coach-count-grid">
                {CLASSES.map((c) => (
                  <Input
                    key={c.short}
                    label={`${c.label} (${c.short})`}
                    type="number"
                    min="0"
                    max="24"
                    inputMode="numeric"
                    size="sm"
                    value={coaches[c.short]}
                    onChange={(e) => setCoaches((x) => ({ ...x, [c.short]: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <Row className="g-3">
            <Col md={3}>
              <Input
                label="Base fare (₹)"
                hint="Added to the per-km fare"
                type="number"
                min="0"
                inputMode="decimal"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
              />
            </Col>
            <Col md={5}>
              <Input
                label="Only trains stopping at"
                hint="Station codes, e.g. SBC UBL MYS. Empty = all trains"
                value={only}
                maxLength={200}
                onChange={(e) => setOnly(e.target.value.toUpperCase())}
              />
            </Col>
            <Col md={4}>
              <Input
                label="At most"
                hint="Trains, lowest numbers first. Empty = no limit"
                type="number"
                min="1"
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </Col>
          </Row>
          {optionProblem && <Note tone="warn">{optionProblem}</Note>}
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="p-4 vstack gap-3">
              <h2 className="h5 mb-0">Karnataka trains</h2>
              {summary ? (
                <>
                  <p className="mb-0">
                    <strong>{fmt(summary.trains)}</strong> trains running in Karnataka, including the Vande Bharat trains, and <strong>{fmt(summary.stations)}</strong> stations
                    (all of them join the station directory
                    {summary.alreadyInDatabase > 0 && <>; {fmt(summary.alreadyInDatabase)} of these trains are already in your database</>}).
                  </p>
                  <div className="d-flex flex-wrap gap-1">
                    {Object.entries(summary.byType || {}).map(([t, n]) => (
                      <span key={t} className="badge rounded-pill text-bg-light border">
                        {t} {fmt(n)}
                      </span>
                    ))}
                  </div>
                  <Note tone="warn">
                    Vande Bharat timings and running days are from 2025 public timetables. The other trains come from DataMeet’s open data (CC0, 2016):
                    their timings may have changed, they run daily, and long-distance trains include only their stops in Karnataka. Passenger trains get
                    second-sitting (2S) coaches. Check important trains after importing.
                  </Note>
                </>
              ) : (
                <p className="text-secondary mb-0">{summaryLoad.busy ? 'Loading…' : 'The bundled list isn’t available.'}</p>
              )}
              <div className="mt-auto">
                <Button variant="accent" onClick={importBundled} busy={start.busy} busyText="Starting…" disabled={!summary || running || !!optionProblem}>
                  <i className="bi bi-cloud-arrow-down" aria-hidden="true" />
                  Import Karnataka trains
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="p-4 vstack gap-3">
              <h2 className="h5 mb-0">From a file</h2>
              <p className="mb-0 small">
                <strong>CSV</strong>: one row per stop. Train name, type, days and classes only need to be on a train’s first row. Leave km empty to work it
                out from station positions. Days: <code>daily</code> or e.g. <code>mon wed fri</code>. Classes: <code>SL 3A 2A 1A 3E CC EC 2S</code>.
              </p>
              <p className="mb-0 small">
                <strong>JSON</strong>: a <code>trains</code> list, and optionally <code>stations</code> for codes that aren’t in the directory yet.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => download('trains-template.csv', CSV_TEMPLATE, 'text/csv')}>
                  <i className="bi bi-filetype-csv" aria-hidden="true" />
                  CSV template
                </Button>
                <Button variant="outline" size="sm" onClick={() => download('trains-example.json', JSON_TEMPLATE, 'application/json')}>
                  <i className="bi bi-filetype-json" aria-hidden="true" />
                  JSON example
                </Button>
              </div>
              <form onSubmit={importFile} className="vstack gap-3 mt-auto" noValidate>
                <div>
                  <label htmlFor="import-file" className="form-label">
                    Train list (.csv or .json, up to 20 MB)
                  </label>
                  <input
                    id="import-file"
                    type="file"
                    className="form-control"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <Button type="submit" busy={start.busy} busyText="Uploading…" disabled={!file || running || !!optionProblem || file.size > 20 * 1024 * 1024}>
                    <i className="bi bi-upload" aria-hidden="true" />
                    Import file
                  </Button>
                  {file && file.size > 20 * 1024 * 1024 && <span className="small text-danger ms-2">The file is larger than 20 MB.</span>}
                </div>
              </form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
