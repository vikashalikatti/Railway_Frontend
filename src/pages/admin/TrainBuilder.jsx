import { useEffect, useState } from 'react';
import { adminApi, SEAT_TYPES } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, ErrorNote, Input, Note, rupees } from '../../components/ui.jsx';
import useForm, { digits } from '../../useForm.js';
import { focusFirstError, rules } from '../../validate.js';
import { nextStep, STEPS } from './trainStore.js';
import StationInput from '../../components/StationInput.jsx';
import AddStationDialog from './AddStationDialog.jsx';
import QuotaEditor from './QuotaEditor.jsx';
import CoachChanges, { coachDates } from './CoachChanges.jsx';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const STEP_TITLES = {
  train: 'Train details',
  schedule: 'Running days',
  stations: 'Stops and timings',
  route: 'Fares',
  seats: 'Coaches',
};

/**
 * The backend needs these in order: a train must exist before its schedule,
 * stops must exist before fares and coaches (both are priced per stop).
 */
const EDIT_LABELS = {
  schedule: 'Change days',
  stations: 'Edit stops and timings',
  route: 'Change fare',
  seats: 'Change coaches',
};

export default function TrainBuilder({ train, onChange, takenNumbers = [] }) {
  const [editing, setEditing] = useState(null); // a finished step that has been reopened
  const current = train ? editing || nextStep(train) : 'train';

  const complete = (step, patch = {}) => {
    setEditing(null);
    const base = train || {};
    onChange({ ...base, ...patch, done: { ...(base.done || {}), [step]: true } });
  };

  return (
    <div className="card shadow-sm border-0 border-top border-4 border-primary">
      <div className="card-body p-4">
      <h2 className="h4 mb-4 d-flex align-items-center gap-2">
        {train ? (
          <>
            <span className="badge text-bg-primary">{train.trainNumber}</span> {train.trainName}
          </>
        ) : (
          <>
            <i className="bi bi-plus-circle text-accent" aria-hidden="true" /> Add a train
          </>
        )}
      </h2>
      <ol className="steps">
        {STEPS.map((step, i) => {
          const done = train?.done?.[step];
          const open = step === current;
          return (
            <li key={step} className={`step ${done ? 'is-done' : ''} ${open ? 'is-open' : ''}`}>
              <div className="step-head">
                <span className="step-num" aria-hidden="true">
                  {done ? <i className="bi bi-check-lg" /> : i + 1}
                </span>
                <h3>{STEP_TITLES[step]}</h3>
                {done && <span className="small text-secondary">{summary(step, train)}</span>}
                {done && !open && EDIT_LABELS[step] && (
                  <button type="button" className="btn btn-link btn-sm p-0 ms-auto" onClick={() => setEditing(step)}>
                    <i className="bi bi-pencil me-1" aria-hidden="true" />
                    {EDIT_LABELS[step]}
                  </button>
                )}
                {open && editing === step && (
                  <button type="button" className="btn btn-link btn-sm p-0 ms-auto text-secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                )}
              </div>
              {open && (
                <div className="mt-3">
                  {step === 'train' && <TrainStep takenNumbers={takenNumbers} onDone={(t) => complete('train', t)} />}
                  {step === 'schedule' && <ScheduleStep train={train} onDone={(p) => complete('schedule', p)} />}
                  {step === 'stations' && <StationsStep train={train} onDone={(p) => complete('stations', p)} />}
                  {step === 'route' && <RouteStep train={train} onDone={(p) => complete('route', p)} />}
                  {step === 'seats' && <SeatsStep train={train} onDone={(p) => complete('seats', p)} />}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {train && !current && <CoachTable coaches={train.coaches} />}
      {train && !current && <CoachChanges train={train} onChange={onChange} />}
      {train && !current && <QuotaEditor key={`${train.trainNumber}-${(train.coaches || []).length}`} trainNumber={train.trainNumber} />}
      </div>
    </div>
  );
}

function summary(step, t) {
  if (!t) return '';
  switch (step) {
    case 'train':
      return `${t.sourceStation} to ${t.destinationStation}${t.train_type ? `, ${t.train_type}` : ''}`;
    case 'schedule':
      return t.days?.length === 7 ? 'Daily' : (t.days || []).map((d) => cap(d).slice(0, 3)).join(', ');
    case 'stations':
      return `${t.stops?.length || 0} stops`;
    case 'route':
      return t.basePrice != null ? `Base fare ${rupees(t.basePrice)}` : 'Set';
    case 'seats': {
      const dated = (t.coaches || []).filter((c) => c.validFrom || c.validTo).length;
      return `${t.coaches?.length || 0} coaches, ${t.totalSeats} seats today${dated ? `, ${dated} with dates` : ''}`;
    }
    default:
      return '';
  }
}

/* Step 1 ---------------------------------------------------------------- */
function TrainStep({ onDone, takenNumbers = [] }) {
  const { session, notifyError } = useSession();
  const { busy, error, run } = useAction();
  const [codes, setCodes] = useState({ source: null, destination: null });
  const form = useForm({ trainNumber: '', trainName: '', sourceStation: '', destinationStation: '', train_type: '' }, (v) => ({
    trainNumber: [
      rules.trainNumber,
      // checked again by the backend
      (n) => (takenNumbers.includes(Number(n)) ? 'A train with this number already exists.' : ''),
    ],
    trainName: (n) => {
      const t = String(n).trim();
      if (!t) return 'Enter the train name.';
      if (t.length < 3) return 'Train name must be at least 3 characters.';
      return '';
    },
    sourceStation: rules.station('starting'),
    destinationStation: [
      rules.station('last'),
      (d) => (d.trim() && d.trim().toLowerCase() === v.sourceStation.trim().toLowerCase() ? 'The train must end at a different station.' : ''),
    ],
  }));

  const send = (f) => {
    const data = {
      trainNumber: Number(f.trainNumber),
      trainName: f.trainName.trim(),
      sourceStation: f.sourceStation.trim(),
      destinationStation: f.destinationStation.trim(),
      train_type: f.train_type.trim(),
    };
    run(async () => {
      try {
        await adminApi.addTrain(session.token, data);
      } catch (err) {
        if (err.status === 409) {
          form.setFieldError('trainNumber', 'A train with this number already exists.');
          notifyError(err.message);
          return;
        }
        throw err;
      }
      onDone({ ...data, sourceCode: codes.source, destinationCode: codes.destination });
    });
  };

  return (
    <form className="grid-2" ref={form.formRef} onSubmit={form.submit(send)} noValidate>
      <Input label="Train number" inputMode="numeric" hint="5 digits, e.g. 16591." {...form.bind('trainNumber', { transform: digits(5) })} />
      <Input label="Train name" {...form.bind('trainName')} />
      <StationInput
        label="Starts at"
        placeholder="Code or station name"
        cities={false}
        value={form.values.sourceStation}
        error={form.errors.sourceStation}
        onChange={(t) => {
          form.setValue('sourceStation', t);
          setCodes((c) => ({ ...c, source: null }));
        }}
        onSelect={(sug) => {
          form.setValue('sourceStation', sug.name);
          setCodes((c) => ({ ...c, source: sug.code }));
        }}
      />
      <StationInput
        label="Ends at"
        placeholder="Code or station name"
        cities={false}
        value={form.values.destinationStation}
        error={form.errors.destinationStation}
        onChange={(t) => {
          form.setValue('destinationStation', t);
          setCodes((c) => ({ ...c, destination: null }));
        }}
        onSelect={(sug) => {
          form.setValue('destinationStation', sug.name);
          setCodes((c) => ({ ...c, destination: sug.code }));
        }}
      />
      <Input label="Type (optional)" placeholder="Express, Superfast, Shatabdi…" {...form.bind('train_type')} />
      <div className="span-2 vstack gap-3 align-items-start">
        <ErrorNote>{error}</ErrorNote>
        <Button busy={busy} busyText="Saving train…" type="submit">
          Save train
        </Button>
      </div>
    </form>
  );
}

/* Step 2 ---------------------------------------------------------------- */
function ScheduleStep({ train, onDone }) {
  const { session } = useSession();
  const { busy, error, setError, run } = useAction();
  const [days, setDays] = useState(train.days || []);

  const toggle = (d) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const submit = (e) => {
    e.preventDefault();
    if (!days.length) {
      setError('Choose at least one day.');
      return;
    }
    const ordered = DAYS.filter((d) => days.includes(d));
    run(async () => {
      await adminApi.addSchedule(session.token, train.trainNumber, ordered);
      onDone({ days: ordered });
    });
  };

  return (
    <form className="vstack gap-3 align-items-start" onSubmit={submit}>
      <div className="d-flex flex-wrap align-items-center gap-2" role="group" aria-label="Days the train runs">
        {DAYS.map((d) => (
          <span key={d}>
            <input type="checkbox" className="btn-check" id={`day-${d}`} checked={days.includes(d)} onChange={() => toggle(d)} autoComplete="off" />
            <label className="btn btn-outline-primary day-toggle" htmlFor={`day-${d}`}>
              {cap(d).slice(0, 3)}
            </label>
          </span>
        ))}
        <button type="button" className="btn btn-link btn-sm" onClick={() => setDays(days.length === 7 ? [] : DAYS)}>
          {days.length === 7 ? 'Clear' : 'Every day'}
        </button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <Button busy={busy} busyText="Saving…" type="submit">
        Save running days
      </Button>
    </form>
  );
}

/* Step 3 ---------------------------------------------------------------- */
// kmAuto: km was filled in from the stations' map positions; kmManual: the admin typed it
const blankStop = (name = '', code = null) => ({
  stationName: name,
  stationCode: code,
  arrivalTime: '',
  departureTime: '',
  km: '',
  kmAuto: false,
  kmManual: false,
});

/** A station change makes the km into this stop and out of it stale, unless the admin typed them */
const stationChanged = (stops, i, patch) =>
  stops.map((x, j) => {
    if (j === i) return { ...x, ...patch, kmManual: false };
    if (j === i + 1) return { ...x, kmManual: false };
    return x;
  });

function stopErrors(stops) {
  const last = stops.length - 1;
  const seen = {};
  return stops.map((s, i) => {
    const e = {};
    const name = s.stationName.trim();
    if (!name) e.stationName = 'Enter the station name.';
    else if (name.length < 2) e.stationName = 'Station name is too short.';
    else if (seen[name.toLowerCase()] !== undefined) e.stationName = 'This station is already on the route.';
    if (name) seen[name.toLowerCase()] = i;
    if (i === 0 && !s.departureTime) e.departureTime = 'Enter the departure time.';
    if (i > 0 && !s.arrivalTime) e.arrivalTime = 'Enter the arrival time.';
    if (i > 0 && i < last && !s.departureTime) e.departureTime = 'Enter the departure time.';
    if (i > 0) {
      const km = Number(s.km);
      if (s.km === '' || !(km > 0)) e.km = 'Distance must be more than 0 km.';
      else if (km > 3000) e.km = 'Distance looks too large.';
    }
    return e;
  });
}

function StationsStep({ train, onDone }) {
  const { session } = useSession();
  const { busy, error, run } = useAction();
  const saved = train.stops || [];
  const editing = saved.length >= 2;
  const [stops, setStops] = useState(() =>
    editing
      ? saved.map((s, i) => ({
          ...blankStop(s.stationName, s.stationCode || null),
          arrivalTime: i === 0 ? '' : s.arrivalTime || '',
          departureTime: i === saved.length - 1 ? '' : s.departureTime || '',
          km: i === 0 ? '' : String(s.km || ''),
          kmManual: i > 0 && s.km > 0, // keep saved distances unless asked to re-estimate
        }))
      : [blankStop(train.sourceStation, train.sourceCode || null), blankStop(train.destinationStation, train.destinationCode || null)]
  );
  const [errors, setErrors] = useState([]);
  const [formEl, setFormEl] = useState(null);
  const [adding, setAdding] = useState(null); // { row, text } while the "add a station" dialog is open

  const pickStation = (i, station) => {
    setStops((prev) => stationChanged(prev, i, { stationName: station.name, stationCode: station.code }));
  };

  // Fill in km between stops whose stations are in the directory. Typed values are kept.
  const codesKey = stops.map((s) => s.stationCode || '').join(',');
  const [estimateRun, setEstimateRun] = useState(0); // bumped by "Replace distances with estimates"
  useEffect(() => {
    const codes = codesKey.split(',');
    if (codes.filter(Boolean).length < 2) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      adminApi
        .distances(session.token, codes)
        .then((res) => {
          if (!live) return;
          const legs = Array.isArray(res.data2) ? res.data2 : [];
          setStops((prev) => {
            if (prev.map((s) => s.stationCode || '').join(',') !== codesKey) return prev; // stops changed meanwhile
            return prev.map((s, i) => {
              if (i === 0 || s.kmManual) return s;
              const km = legs[i];
              if (km == null) return s.kmAuto ? { ...s, km: '', kmAuto: false } : s;
              return { ...s, km: String(km), kmAuto: true };
            });
          });
        })
        .catch(() => {
          /* estimates are a convenience; the admin can still type the km */
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [codesKey, estimateRun, session.token]);

  // Keep error messages current once they're showing (also after km is filled in)
  useEffect(() => {
    if (errors.length) setErrors(stopErrors(stops));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  const totalKm = stops.slice(1).reduce((sum, s) => sum + (Number(s.km) || 0), 0);
  const canEstimate = stops.filter((s) => s.stationCode).length >= 2 && stops.some((s, i) => i > 0 && s.kmManual);
  const reEstimate = () => {
    setStops((prev) => prev.map((x) => ({ ...x, kmManual: false })));
    setEstimateRun((n) => n + 1);
  };
  const anyEstimated = stops.some((s, i) => i > 0 && s.kmAuto);

  const update = (i, k, v) => {
    const next = stops.map((x, j) => (j === i ? { ...x, [k]: v } : x));
    setStops(next);
    if (errors.length) setErrors(stopErrors(next)); // keep messages current once shown
  };
  // The stop after an inserted or removed one now has a different previous stop, so its km is re-estimated
  const freshKm = (x) => ({ ...x, kmManual: false });
  const insert = (i) => {
    setStops((s) => [...s.slice(0, i), blankStop(), ...s.slice(i).map((x, j) => (j === 0 ? freshKm(x) : x))]);
    setErrors([]);
  };
  const remove = (i) => {
    setStops((s) => s.filter((_, j) => j !== i).map((x, j) => (j === i ? freshKm(x) : x)));
    setErrors([]);
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = stopErrors(stops);
    if (errs.some((x) => Object.keys(x).length)) {
      setErrors(errs);
      setTimeout(() => focusFirstError(formEl), 0);
      return;
    }
    setErrors([]);
    const payload = stops.map((s, i) => {
      // First stop has no arrival and last has no departure; the backend still needs both times
      const arr = s.arrivalTime || s.departureTime;
      const dep = s.departureTime || s.arrivalTime;
      return {
        stationName: s.stationName.trim(),
        stationCode: s.stationCode || null,
        arrivalTime: arr,
        departureTime: dep,
        km: i === 0 ? 0 : Number(s.km),
      };
    });
    run(async () => {
      await adminApi.addStations(session.token, train.trainNumber, payload);
      onDone({
        stops: payload,
        sourceStation: payload[0].stationName,
        destinationStation: payload[payload.length - 1].stationName,
      });
    });
  };

  const inv = (i, k) => (errors[i]?.[k] ? 'true' : undefined);

  return (
    <form className="vstack gap-3 align-items-stretch" onSubmit={submit} ref={setFormEl} noValidate>
      <div role="table" aria-label="Stops">
        <div className="stop-row small fw-semibold text-secondary d-none d-md-grid mb-1" role="row">
          <span role="columnheader">Station</span>
          <span role="columnheader">Arrives</span>
          <span role="columnheader">Departs</span>
          <span role="columnheader">Km from previous stop</span>
          <span />
        </div>
        {stops.map((s, i) => {
          const first = i === 0;
          const last = i === stops.length - 1;
          const msgs = Object.values(errors[i] || {});
          return (
            <div key={i} className="d-flex flex-column">
              <div className="stop-row" role="row">
                <StationInput
                  hideLabel
                  ariaLabel={`Stop ${i + 1} station`}
                  label={`Stop ${i + 1}`}
                  placeholder="Code or station name"
                  cities={false}
                  value={s.stationCode ? `${s.stationName}` : s.stationName}
                  inputClassName={inv(i, 'stationName') ? 'is-invalid' : ''}
                  onChange={(text) => setStops((prev) => stationChanged(prev, i, { stationName: text, stationCode: null }))}
                  onSelect={(sug) => pickStation(i, { name: sug.name, code: sug.code })}
                  onCreate={(text) => setAdding({ row: i, text })}
                />
                <input
                  className={`form-control ${inv(i, 'arrivalTime') ? 'is-invalid' : ''}`}
                  aria-label={`Stop ${i + 1} arrival time`}
                  aria-invalid={inv(i, 'arrivalTime')}
                  type="time"
                  disabled={first}
                  value={first ? '' : s.arrivalTime}
                  onChange={(e) => update(i, 'arrivalTime', e.target.value)}
                />
                <input
                  className={`form-control ${inv(i, 'departureTime') ? 'is-invalid' : ''}`}
                  aria-label={`Stop ${i + 1} departure time`}
                  aria-invalid={inv(i, 'departureTime')}
                  type="time"
                  disabled={last}
                  value={last ? '' : s.departureTime}
                  onChange={(e) => update(i, 'departureTime', e.target.value)}
                />
                <div className="km-cell">
                  <input
                    className={`form-control ${inv(i, 'km') ? 'is-invalid' : ''} ${!first && s.kmAuto ? 'has-est' : ''}`}
                    placeholder={first ? '' : 'km'}
                    aria-label={`Stop ${i + 1} distance from previous stop in km${s.kmAuto ? ', estimated' : ''}`}
                    aria-invalid={inv(i, 'km')}
                    inputMode="decimal"
                    disabled={first}
                    value={first ? '' : s.km}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, '');
                      setStops((prev) => prev.map((x, j) => (j === i ? { ...x, km: v, kmAuto: false, kmManual: v !== '' } : x)));
                    }}
                  />
                  {!first && s.kmAuto && (
                    <span className="km-est" title="Estimated from the two stations’ map positions. Type to change it." aria-hidden="true">
                      est.
                    </span>
                  )}
                </div>
                {!first && !last ? (
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(i)} aria-label={`Remove stop ${i + 1}`}>
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {msgs.length > 0 && (
                <span className="invalid-feedback d-block" role="alert">
                  Stop {i + 1}: {msgs.join(' ')}
                </span>
              )}
              {!last && (
                <button type="button" className="insert-stop" onClick={() => insert(i + 1)}>
                  <i className="bi bi-plus me-1" aria-hidden="true" />
                  Add a stop here
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <Note>
          Add, remove or reorder stops only while the train has no upcoming bookings. Timings and distances can be changed at
          any time.
        </Note>
      )}
      {canEstimate && (
        <button type="button" className="btn btn-link btn-sm p-0 align-self-start" onClick={reEstimate}>
          <i className="bi bi-rulers me-1" aria-hidden="true" />
          Replace distances with estimates from the station map
        </button>
      )}
      {totalKm > 0 && (
        <p className="small text-secondary mb-0">
          <strong className="text-dark">Total {Math.round(totalKm).toLocaleString('en-IN')} km.</strong>{' '}
          {anyEstimated
            ? 'Distances marked est. are worked out from the stations’ map positions. Change any that differ from the timetable.'
            : 'Each box is the distance from the stop above it, not from the start.'}
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>
      <AddStationDialog
        show={!!adding}
        initialName={adding?.text || ''}
        onClose={() => setAdding(null)}
        onCreated={(st) => {
          if (adding) pickStation(adding.row, { name: st.name, code: st.code });
          setAdding(null);
        }}
      />
      <Button busy={busy} busyText="Saving stops…" type="submit">
        {editing ? `Save changes (${stops.length} stops)` : `Save ${stops.length} stops`}
      </Button>
    </form>
  );
}

/* Step 4 ---------------------------------------------------------------- */
function RouteStep({ train, onDone }) {
  const { session } = useSession();
  const { busy, error, run } = useAction();
  const stops = train.stops || [];
  const totalKm = stops.reduce((sum, st) => sum + (Number(st.km) || 0), 0);
  const form = useForm({ price: train.basePrice != null ? String(train.basePrice) : '' }, () => ({
    price: rules.positive('base fare', 10000),
  }));

  const send = (v) =>
    run(async () => {
      await adminApi.addRoute(session.token, train.trainNumber, {
        startStation: stops[0]?.stationName || train.sourceStation,
        endStation: stops[stops.length - 1]?.stationName || train.destinationStation,
        price: Number(v.price),
      });
      onDone({ basePrice: Number(v.price) });
    });

  return (
    <form className="grid-2" ref={form.formRef} onSubmit={form.submit(send)} noValidate>
      <Input
        label="Base fare (₹)"
        inputMode="decimal"
        hint="A passenger pays the base fare plus a per-km charge for their class over the km they travel."
        {...form.bind('price', { transform: (x) => x.replace(/[^\d.]/g, '') })}
      />
      <div className="small text-secondary align-self-center">
        {stops.length >= 2 && (
          <>
            {stops[0].stationName} to {stops[stops.length - 1].stationName}
            {totalKm > 0 && `, ${Math.round(totalKm).toLocaleString('en-IN')} km`}
          </>
        )}
      </div>
      <div className="span-2 vstack gap-3 align-items-start">
        {train.done?.route && <Note>Tickets already booked keep the fare they were sold at.</Note>}
        <ErrorNote>{error}</ErrorNote>
        <Button busy={busy} busyText="Saving fare…" type="submit">
          {train.done?.route ? 'Save fare' : 'Save fares'}
        </Button>
      </div>
    </form>
  );
}

/* Step 5 ---------------------------------------------------------------- */
const CAPACITY = Object.fromEntries(SEAT_TYPES.map((t) => [t.id, t.seats]));
const PREFIX = Object.fromEntries(SEAT_TYPES.map((t) => [t.id, t.prefix]));
const DEFAULT_COUNTS = { ...Object.fromEntries(SEAT_TYPES.map((t) => [t.id, 0])), AC2_TIER: 1, AC3_TIER: 3, SLEEPER_CLASS: 8, SECOND_CLASS: 2 };
const MAX_COACHES = 24;

function SeatsStep({ train, onDone }) {
  const { session } = useSession();
  const { busy, error, setError, run } = useAction();
  const [counts, setCounts] = useState(() => {
    if (!train.coaches?.length) return DEFAULT_COUNTS;
    const now = Object.fromEntries(SEAT_TYPES.map((t) => [t.id, 0]));
    train.coaches.forEach((c) => {
      if (c.coachType in now) now[c.coachType] += 1;
    });
    return now;
  });

  const totalCoaches = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalSeats = Object.entries(counts).reduce((a, [k, n]) => a + n * CAPACITY[k], 0);
  const set = (k, n) => setCounts((c) => ({ ...c, [k]: Math.max(0, Math.min(MAX_COACHES, n)) }));

  const submit = (e) => {
    e.preventDefault();
    if (totalCoaches < 1) {
      setError('Add at least one coach.');
      return;
    }
    if (totalCoaches > MAX_COACHES) {
      setError(`A train can have at most ${MAX_COACHES} coaches.`);
      return;
    }
    run(async () => {
      const res = await adminApi.addCoaches(session.token, train.trainNumber, counts);
      const coaches = (res.data2?.coaches || [])
        .filter((c) => c && typeof c === 'object')
        .map(({ coachNumber, coachType, numberOfSeats }) => ({ coachNumber, coachType, numberOfSeats }));
      onDone({ totalSeats, coaches });
    });
  };

  return (
    <form className="vstack gap-3 align-items-start" onSubmit={submit} noValidate>
      <div className="border rounded-3 w-100" role="group" aria-label="Number of coaches per class">
        {SEAT_TYPES.slice()
          .reverse()
          .map((t) => (
            <div className="d-flex justify-content-between align-items-center gap-3 px-3 py-2 border-bottom" key={t.id}>
              <span className="fw-bold text-dark">
                {t.label} ({t.short})
                <small className="d-block fw-normal text-secondary">
                  {CAPACITY[t.id]} {t.berths ? 'berths' : 'seats'} per coach ({t.layout}), numbered {PREFIX[t.id]}1, {PREFIX[t.id]}2…
                </small>
              </span>
              <div className="input-group flex-nowrap" style={{ width: 140 }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => set(t.id, counts[t.id] - 1)} aria-label={`One fewer ${t.label} coach`} disabled={counts[t.id] === 0}>
                  <i className="bi bi-dash-lg" aria-hidden="true" />
                </button>
                <input
                  className="form-control text-center fw-bold"
                  inputMode="numeric"
                  aria-label={`${t.label} coaches`}
                  value={counts[t.id]}
                  onChange={(e) => set(t.id, Number(e.target.value.replace(/\D/g, '') || 0))}
                />
                <button type="button" className="btn btn-outline-secondary" onClick={() => set(t.id, counts[t.id] + 1)} aria-label={`One more ${t.label} coach`}>
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
      </div>
      <p className={`fw-bold mb-0 ${totalCoaches > MAX_COACHES ? 'text-danger' : 'text-dark'}`}>
        {totalCoaches} {totalCoaches === 1 ? 'coach' : 'coaches'}, {totalSeats.toLocaleString('en-IN')} seats
        {totalCoaches > MAX_COACHES ? ` (max ${MAX_COACHES} coaches)` : ''}
      </p>
      {train.coaches?.length > 0 && (
        <Note tone="warn">
          This replaces all of the train’s coaches, and is only allowed while it has no upcoming bookings (cancelled and past tickets
          don’t count). To add or remove coaches for some dates, use Coach changes below the coaches instead.
        </Note>
      )}
      <ErrorNote>{error}</ErrorNote>
      <Button busy={busy} busyText="Creating coaches…" type="submit">
        {train.coaches?.length > 0 ? 'Replace coaches' : 'Create coaches'}
      </Button>
    </form>
  );
}

/** "SLEEPER_CLASS3" -> "SL3" (older trains); "S3" stays "S3" */
function shortCoach(c) {
  const type = SEAT_TYPES.find((t) => t.id === c.coachType);
  return type && c.coachNumber.startsWith(c.coachType) ? c.coachNumber.replace(c.coachType, type.short) : c.coachNumber;
}

function CoachTable({ coaches }) {
  if (!coaches?.length) return null;
  return (
    <div className="border-top pt-4 mt-2">
      <h3 className="h6 mb-3">Coaches</h3>
      <div className="d-flex flex-wrap gap-2">
        {coaches.map((c) => (
          <div key={c.coachNumber} className={`coach-chip ${SEAT_TYPES.find((t) => t.id === c.coachType)?.ac ? 'ac' : ''} ${coachDates(c) ? 'dated' : ''}`}>
            <strong title={c.coachNumber}>{shortCoach(c)}</strong>
            {c.numberOfSeats} seats
            {coachDates(c) && <small className="d-block text-secondary">{coachDates(c)}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}
