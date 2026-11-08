import { useCallback, useRef, useState } from 'react';
import BsButton from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

/**
 * Bootstrap confirm dialog instead of window.confirm.
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title, body, confirmLabel, danger: true }))) return;
 *   ...render {dialog} somewhere in the component
 */
export default function useConfirm() {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );

  const close = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <Modal show={!!opts} onHide={() => close(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {opts?.danger && <i className="bi bi-exclamation-triangle-fill text-danger me-2" aria-hidden="true" />}
          {opts?.title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>{opts?.body}</Modal.Body>
      <Modal.Footer>
        <BsButton variant="outline-secondary" onClick={() => close(false)}>
          {opts?.cancelLabel || 'Keep it'}
        </BsButton>
        <BsButton variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
          {opts?.confirmLabel || 'Confirm'}
        </BsButton>
      </Modal.Footer>
    </Modal>
  );

  return [confirm, dialog];
}
