import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import { adminApi, ApiError, customerApi, GENERIC_ERROR } from './api.js';

/** What to tell the user about a failure: the backend's reason when it's the user's doing, otherwise a generic line */
export function errorMessage(e) {
  if (e instanceof ApiError && (!e.unexpected || e.status === 0)) return e.message;
  return GENERIC_ERROR;
}

const KEY = 'railway.session';
/** Logged out after this long without a click, key press, scroll or touch */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/**
 * Reads a token's payload: who, role, purpose and expiry. It does NOT check the signature —
 * only the server can do that, and it does on every request. This is for the app's own
 * housekeeping (when to sign out, refusing obviously wrong tokens). null if it isn't a JWT.
 */
export function readToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    const [subject, subjectRole] = String(payload.sub || '').split('|');
    return {
      subject,
      role: payload.role || subjectRole,
      purpose: payload.purpose || 'login',
      exp: Number(payload.exp) * 1000,
    };
  } catch {
    return null;
  }
}

/** When this log-in token stops working (a little early), or null if it isn't a usable log-in token for this role */
function expiryOf(token, role) {
  const info = readToken(token);
  if (!info || info.purpose !== 'login' || info.role !== role || !(info.exp > Date.now())) return null;
  return info.exp - 30 * 1000;
}

function clearStored() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The saved session, if it is still usable. A session edited by hand (wrong role, bad token) is dropped. */
function load() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY));
    if (!s || typeof s !== 'object') return null;
    const expires = expiryOf(s.token, s.role);
    if (!expires || Date.now() >= expires) {
      clearStored();
      return null;
    }
    return { role: s.role, token: s.token, email: s.email, name: s.name, expires };
  } catch {
    return null;
  }
}

const TONES = {
  success: { icon: 'bi-check-circle-fill', color: 'text-success', title: 'Done' },
  good: { icon: 'bi-check-circle-fill', color: 'text-success', title: 'Done' },
  danger: { icon: 'bi-exclamation-octagon-fill', color: 'text-danger', title: 'Something went wrong' },
  warning: { icon: 'bi-exclamation-triangle-fill', color: 'text-warning', title: 'Heads up' },
  info: { icon: 'bi-info-circle-fill', color: 'text-info', title: 'Info' },
};

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(load);
  const [toasts, setToasts] = useState([]);
  const [loginPrompt, setLoginPrompt] = useState(null); // { reason, onSuccess } while the log-in dialog is open
  const nextId = useRef(1);

  const askLogin = useCallback((reason = '', onSuccess = null) => setLoginPrompt({ reason, onSuccess }), []);
  const closeLogin = useCallback(() => setLoginPrompt(null), []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  /** Saves a session after a successful log-in. Only these fields are kept. */
  const login = useCallback((data) => {
    const expires = expiryOf(data?.token, data?.role);
    if (!expires) throw new ApiError(GENERIC_ERROR, 0, null, true); // the server sent something that isn't a log-in token
    const s = { role: data.role, token: data.token, email: data.email, name: data.name, expires };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable: keep it in memory */
    }
    setSession(s);
  }, []);

  /** Signs out here and ends the token on the server too (everywhere: on every device) */
  const logout = useCallback(({ everywhere = false } = {}) => {
    const current = sessionRef.current;
    if (current?.token) {
      const api = current.role === 'admin' ? adminApi : customerApi;
      api.logout(current.token, everywhere).catch(() => {
        /* already expired or offline: signing out here is what matters */
      });
    }
    clearStored();
    setSession(null);
  }, []);

  /**
   * Shows a toast. tone: success | danger | warning | info.
   * The same message isn't stacked twice while it's still on screen.
   */
  const notify = useCallback((message, tone = 'info', title) => {
    const t = tone === 'good' ? 'success' : tone;
    setToasts((list) => {
      if (list.some((x) => x.message === message && x.tone === t)) return list;
      const id = nextId.current++;
      return [...list.slice(-3), { id, message, tone: t, title: title || TONES[t]?.title }];
    });
  }, []);

  /** Shorthand for errors: title "Something went wrong" */
  const notifyError = useCallback((message) => notify(message || GENERIC_ERROR, 'danger'), [notify]);

  const dismiss = (id) => setToasts((list) => list.filter((x) => x.id !== id));

  // Sign out after a while without any activity, so a shared or unattended computer doesn't stay logged in
  useEffect(() => {
    if (!session) return undefined;
    let last = Date.now();
    const seen = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, seen, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > IDLE_LIMIT_MS) {
        logout();
        notify('You were logged out after 30 minutes without activity.', 'warning', 'Logged out');
      }
    }, 30 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, seen));
      clearInterval(timer);
    };
  }, [session, logout, notify]);

  // Sign out automatically when the token's lifetime runs out
  useEffect(() => {
    if (!session) return;
    const ms = session.expires - Date.now();
    const t = setTimeout(() => {
      logout();
      notify('Your session ended after an hour. Log in again to continue.', 'warning', 'Logged out');
    }, Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [session, logout, notify]);

  // Any error nobody caught (a failed promise, a script error) still shows a toast
  useEffect(() => {
    const onRejection = (e) => {
      console.error(e.reason);
      notifyError(errorMessage(e.reason));
    };
    const onError = (e) => {
      console.error(e.error || e.message);
      notifyError(GENERIC_ERROR);
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, [notifyError]);

  return (
    <SessionContext.Provider value={{ session, login, logout, notify, notifyError, loginPrompt, askLogin, closeLogin }}>
      {children}
      <ToastContainer position="top-end" className="toast-stack p-3 position-fixed" aria-live="polite">
        {toasts.map((t) => {
          const look = TONES[t.tone] || TONES.info;
          return (
            <Toast
              key={t.id}
              className={`tone-${t.tone}`}
              onClose={() => dismiss(t.id)}
              delay={t.tone === 'danger' ? 7000 : 4500}
              autohide
              role={t.tone === 'danger' ? 'alert' : 'status'}
            >
              <Toast.Header closeLabel="Close">
                <i className={`bi ${look.icon} ${look.color} me-2`} aria-hidden="true" />
                <strong className="me-auto">{t.title}</strong>
              </Toast.Header>
              <Toast.Body>{t.message}</Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

/**
 * Wraps an async action with a busy flag. Any failure shows a toast:
 *  - session expired (401/403): signs out and says so
 *  - server/network/bug: "Something went wrong. Please try again in a moment."
 *  - a rule the backend refused (wrong OTP, no seats...): "Something went wrong" + the reason
 *
 * `error` / `setError` remain for messages shown inline next to a form (local checks).
 */
export function useAction() {
  const { logout, notify, notifyError } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      setError('');
      try {
        return await fn();
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) {
          logout();
          notify('Your session has ended. Log in again to continue.', 'warning', 'Logged out');
        } else {
          console.error(e);
          notifyError(errorMessage(e));
        }
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [logout, notify, notifyError]
  );

  return { busy, error, setError, run };
}
