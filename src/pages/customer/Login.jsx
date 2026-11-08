import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Panel, PasswordInput } from '../../components/ui.jsx';
import useForm from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from './AuthLayout.jsx';

export const loginSchema = () => ({ email: rules.email, password: rules.required('your password') });

/** Friendlier wording for the backend's log-in failures */
export function loginMessage(err) {
  if (/not verified/i.test(err.message)) return 'Your email isn’t verified yet. Enter the OTP we emailed you to finish signing up.';
  if (/wrong email or password|no user|bad credentials/i.test(err.message))
    return 'Wrong email or password. Try again, or reset your password.';
  // "Too many attempts. Try again in 15 minutes." and other reasons are shown as they are
  return err.message;
}

export default function Login() {
  const { login, notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const form = useForm({ email: '', password: '' }, loginSchema);
  const [unverified, setUnverified] = useState(false);

  const send = (v) =>
    run(async () => {
      try {
        const res = await customerApi.login(v.email.trim(), v.password);
        login({ role: 'customer', token: res.data, email: v.email.trim() });
        notify('You’re logged in.', 'success', 'Welcome back');
        navigate('/');
      } catch (err) {
        setUnverified(/not verified/i.test(err.message));
        notifyError(loginMessage(err));
      }
    });

  return (
    <AuthLayout>
      <Panel title="Log in to book tickets" icon="bi-person-circle">
        <form ref={form.formRef} onSubmit={form.submit(send)} className="vstack gap-3" noValidate>
          <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
          <PasswordInput label="Password" autoComplete="current-password" {...form.bind('password')} />
          {unverified && (
            <Button as={Link} variant="outline" to="/verify" state={{ email: form.values.email.trim() }}>
              <i className="bi bi-envelope-check" aria-hidden="true" />
              Enter my OTP
            </Button>
          )}
          <Button busy={busy} busyText="Logging in…" type="submit" variant="accent" size="lg">
            Log in
          </Button>
        </form>
        <div className="d-flex flex-wrap justify-content-between gap-2 mt-4 small">
          <Link to="/forgot">Forgot your password?</Link>
          <span className="text-secondary">
            New here? <Link to="/signup">Create an account</Link>
          </span>
        </div>
      </Panel>
    </AuthLayout>
  );
}
