import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import { customerApi } from '../api.js';
import { errorMessage, useAction, useSession } from '../session.jsx';
import useForm from '../useForm.js';
import { loginMessage, loginSchema } from '../pages/customer/Login.jsx';
import { Button, Input, Note, PasswordInput } from './ui.jsx';

/** Passenger log-in dialog, opened from the header or when a search needs an account */
export default function LoginModal({ open, onClose, onSuccess, reason }) {
  const { login, notify, notifyError } = useSession();
  const { busy, run } = useAction();
  const form = useForm({ email: '', password: '' }, loginSchema);
  const [unverified, setUnverified] = useState(false);

  useEffect(() => {
    if (open) setUnverified(false);
  }, [open]);

  const send = (v) =>
    run(async () => {
      try {
        const res = await customerApi.login(v.email.trim(), v.password);
        login({ role: 'customer', token: res.data, email: v.email.trim() });
        notify('You’re logged in.', 'success', 'Welcome back');
        form.setValue('password', '');
        onSuccess?.();
        onClose();
      } catch (err) {
        setUnverified(/not verified/i.test(err.message));
        notifyError(loginMessage(err) || errorMessage(err));
      }
    });

  return (
    <Modal show={open} onHide={onClose} centered aria-labelledby="login-title">
      <Modal.Header closeButton closeVariant="white" className="bg-primary text-white border-0 pb-0">
        <Nav variant="underline" className="gap-4">
          <Nav.Item>
            <Nav.Link active className="text-white fw-bold" id="login-title" as="span">
              Log in
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link as={Link} to="/signup" onClick={onClose} className="text-white-50 fw-semibold">
              Register
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </Modal.Header>
      <Modal.Body className="p-4">
        <form ref={form.formRef} className="vstack gap-3" onSubmit={form.submit(send)} noValidate>
          {reason && <Note tone="warn">{reason}</Note>}
          <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
          <PasswordInput label="Password" autoComplete="current-password" {...form.bind('password')} />
          {unverified && (
            <Button as={Link} variant="outline" to="/verify" state={{ email: form.values.email.trim() }} onClick={onClose}>
              <i className="bi bi-envelope-check" aria-hidden="true" />
              Enter my OTP
            </Button>
          )}
          <Button busy={busy} busyText="Logging in…" type="submit" variant="accent" size="lg">
            Log in
          </Button>
          <div className="d-flex justify-content-between small">
            <Link to="/forgot" onClick={onClose}>
              Forgot password?
            </Link>
            <Link to="/signup" onClick={onClose}>
              Create an account
            </Link>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
