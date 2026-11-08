import { useId, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import BsButton from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';

/**
 * Form building blocks on React-Bootstrap. Every field takes `error`: it turns the field
 * red (is-invalid + aria-invalid, so the first bad field can be focused) and shows the
 * message under it.
 */

function Feedback({ id, error, hint }) {
  if (error) {
    return (
      <div className="invalid-feedback d-block" id={id} role="alert">
        <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
        {error}
      </div>
    );
  }
  return hint ? <Form.Text className="d-block">{hint}</Form.Text> : null;
}

/** Label + any control + error/hint, for controls that aren't a plain input */
export function Field({ label, hint, error, errorId, children, className = '' }) {
  return (
    <Form.Group className={`field ${className}`}>
      <Form.Label as="span" className="d-block">
        {label}
      </Form.Label>
      {children}
      <Feedback id={errorId} error={error} hint={hint} />
    </Form.Group>
  );
}

/** Every text box has a length limit (200 unless a smaller one is given), so huge pastes never reach the server */
export function Input({ label, hint, error, className = '', inputClassName = '', size, maxLength = 200, ...props }) {
  const id = useId();
  return (
    <Form.Group className={`field ${className}`} controlId={`${id}-in`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        {...props}
        maxLength={maxLength}
        size={size}
        className={inputClassName}
        isInvalid={!!error}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <Feedback id={`${id}-err`} error={error} hint={hint} />
    </Form.Group>
  );
}

/** Password field with a button to show or hide what's typed */
export function PasswordInput({ label = 'Password', hint, error, className = '', maxLength = 64, ...props }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <Form.Group className={`field ${className}`} controlId={`${id}-pw`}>
      <Form.Label>{label}</Form.Label>
      <InputGroup hasValidation>
        <Form.Control
          {...props}
          maxLength={maxLength}
          type={shown ? 'text' : 'password'}
          isInvalid={!!error}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          spellCheck={false}
          autoCapitalize="off"
        />
        <BsButton
          variant="outline-secondary"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          title={shown ? 'Hide password' : 'Show password'}
        >
          <i className={`bi ${shown ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
        </BsButton>
      </InputGroup>
      <Feedback id={`${id}-err`} error={error} hint={hint} />
    </Form.Group>
  );
}

export function Select({ label, hint, error, className = '', children, ...props }) {
  const id = useId();
  return (
    <Form.Group className={`field ${className}`} controlId={`${id}-sel`}>
      <Form.Label>{label}</Form.Label>
      <Form.Select
        {...props}
        isInvalid={!!error}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
      >
        {children}
      </Form.Select>
      <Feedback id={`${id}-err`} error={error} hint={hint} />
    </Form.Group>
  );
}

const VARIANTS = {
  primary: 'primary',
  accent: 'accent',
  outline: 'outline-primary',
  quiet: 'outline-primary',
  danger: 'outline-danger',
  link: 'link',
};

/** Button with a spinner (and optional text such as "Logging in…") while a request runs */
export function Button({ busy, busyText, children, variant = 'primary', className = '', disabled, size, ...props }) {
  return (
    <BsButton
      variant={VARIANTS[variant] || variant}
      className={`d-inline-flex align-items-center justify-content-center gap-2 ${className}`}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      size={size}
      {...props}
    >
      {busy && <Spinner as="span" animation="border" size="sm" aria-hidden="true" />}
      {busy && busyText ? busyText : children}
    </BsButton>
  );
}

/** Inline problem next to a form (local checks). Server errors go to toasts instead. */
export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <Alert variant="danger" className="mb-0 py-2 d-flex gap-2 align-items-start" role="alert">
      <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true" />
      <div>{children}</div>
    </Alert>
  );
}

const NOTE_LOOK = {
  info: { variant: 'primary', icon: 'bi-info-circle-fill' },
  warn: { variant: 'warning', icon: 'bi-exclamation-triangle-fill' },
  success: { variant: 'success', icon: 'bi-check-circle-fill' },
};

export function Note({ children, tone = 'info' }) {
  const look = NOTE_LOOK[tone] || NOTE_LOOK.info;
  return (
    <Alert variant={look.variant} className="mb-0 py-2 d-flex gap-2 align-items-start">
      <i className={`bi ${look.icon} mt-1`} aria-hidden="true" />
      <div>{children}</div>
    </Alert>
  );
}

/** A card with a title, used for forms */
export function Panel({ title, intro, icon, children, className = '' }) {
  const id = useId();
  return (
    <Card as="section" className={`shadow-sm border-0 border-top border-4 border-primary ${className}`} aria-labelledby={id}>
      <Card.Body className="p-4 p-md-5">
        <h1 id={id} className="h3 mb-2 d-flex align-items-center gap-2">
          {icon && <i className={`bi ${icon} text-accent`} aria-hidden="true" />}
          {title}
        </h1>
        {intro && <p className="text-secondary mb-4">{intro}</p>}
        {!intro && <div className="mb-3" />}
        {children}
      </Card.Body>
    </Card>
  );
}

export function formatTime(t) {
  if (!t) return '--:--';
  if (Array.isArray(t)) {
    // Jackson can serialise LocalTime as [h, m] or [h, m, s]
    const [h, m] = t;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return String(t).slice(0, 5);
}

export function minutesOf(t) {
  const s = formatTime(t);
  if (s === '--:--') return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function formatDuration(mins) {
  if (mins == null) return '';
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function rupees(n) {
  if (n == null || Number.isNaN(Number(n))) return '';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function todayIso() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
