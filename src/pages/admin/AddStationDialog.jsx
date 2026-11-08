import { useEffect } from 'react';
import Col from 'react-bootstrap/Col';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input } from '../../components/ui.jsx';
import useForm from '../../useForm.js';

/** "12.9781, 77.5695" (as Google Maps copies it) -> [12.9781, 77.5695]; null if it isn't a position */
export function parsePosition(text) {
  const m = (text || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

const schema = () => ({
  code: (v) => (/^[A-Z]{2,5}$/.test(v || '') ? '' : 'Use 2 to 5 capital letters, e.g. SBC.'),
  name: (v) => ((v || '').trim().length >= 3 ? '' : 'Enter the station name.'),
  city: (v) => ((v || '').trim().length >= 2 ? '' : 'Enter the city.'),
  position: (v) => (!(v || '').trim() || parsePosition(v) ? '' : 'Use latitude, longitude, e.g. 15.3466, 75.1424'),
});

/** Adds a station to the directory. Opened from a stop's "Add … as a new station". */
export default function AddStationDialog({ show, initialName = '', onClose, onCreated }) {
  const { session, notify, notifyError } = useSession();
  const { busy, run } = useAction();
  const form = useForm({ code: '', name: '', city: '', state: '', position: '' }, schema);

  useEffect(() => {
    if (show) {
      const name = initialName.trim();
      // A short all-letters entry is probably a code; anything else is a name
      const looksLikeCode = /^[A-Za-z]{2,5}$/.test(name);
      form.setValues({ code: looksLikeCode ? name.toUpperCase() : '', name: looksLikeCode ? '' : name, city: '', state: '', position: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const send = (v) =>
    run(async () => {
      const pos = parsePosition(v.position);
      try {
        const res = await adminApi.addStation(session.token, {
          code: v.code.trim(),
          name: v.name.trim(),
          city: v.city.trim(),
          state: v.state.trim() || null,
          latitude: pos ? pos[0] : null,
          longitude: pos ? pos[1] : null,
        });
        notify(res.message || `Station ${v.code} added.`, 'success');
        onCreated(res.data2);
      } catch (err) {
        if (/code/i.test(err.message) && !err.unexpected) {
          form.setFieldError('code', err.message);
          notifyError(err.message);
          return;
        }
        if (/named/i.test(err.message) && !err.unexpected) {
          form.setFieldError('name', err.message);
          notifyError(err.message);
          return;
        }
        throw err;
      }
    });

  return (
    <Modal show={show} onHide={onClose} centered>
      <form ref={form.formRef} onSubmit={form.submit(send)} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            <i className="bi bi-geo-alt text-accent me-2" aria-hidden="true" />
            Add a station
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col xs={5}>
              <Input
                label="Code"
                placeholder="SBC"
                maxLength={5}
                {...form.bind('code', { transform: (x) => x.toUpperCase().replace(/[^A-Z]/g, '') })}
              />
            </Col>
            <Col xs={7}>
              <Input label="City" placeholder="Bengaluru" {...form.bind('city')} />
            </Col>
            <Col xs={12}>
              <Input label="Station name" placeholder="KSR Bengaluru City Jn" {...form.bind('name')} />
            </Col>
            <Col xs={12}>
              <Input label="State (optional)" placeholder="Karnataka" {...form.bind('state')} />
            </Col>
            <Col xs={12}>
              <Input
                label="Map position (optional)"
                placeholder="15.3466, 75.1424"
                inputMode="decimal"
                hint="Fills in the km to and from this station. In Google Maps, right-click the station and click the numbers at the top to copy them."
                {...form.bind('position')}
              />
            </Col>
          </Row>
          <p className="small text-secondary mt-3 mb-0">
            Passengers can then find it by its code, its name or its city.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} busyText="Adding…">
            Add station
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
