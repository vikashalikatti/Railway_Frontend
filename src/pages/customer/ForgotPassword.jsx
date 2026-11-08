import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Panel, PasswordInput } from '../../components/ui.jsx';
import useForm, { digits } from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from './AuthLayout.jsx';

const emailSchema = () => ({ email: rules.email });
const otpSchema = () => ({ otp: rules.otp });
const passwordSchema = (v) => ({ password: rules.newPassword, confirm: rules.confirm(v.password) });

const STEPS = ['email', 'otp', 'password'];

/** Three steps: request an OTP, confirm it (returns a short-lived token), then set the new password */
export default function ForgotPassword() {
  const { notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  const emailForm = useForm({ email: '' }, emailSchema);
  const otpForm = useForm({ otp: '' }, otpSchema);
  const pwForm = useForm({ password: '', confirm: '' }, passwordSchema);

  const sendOtp = (v) =>
    run(async () => {
      try {
        await customerApi.forgotPassword(v.email.trim());
      } catch (err) {
        if (err.status === 400 && /exist/i.test(err.message)) {
          emailForm.setFieldError('email', 'There’s no account with this email.');
          notifyError('There’s no account with this email.');
          return;
        }
        throw err;
      }
      setEmail(v.email.trim());
      notify(`OTP sent to ${v.email.trim()}.`, 'success');
      setStep('otp');
    });

  const checkOtp = (v) =>
    run(async () => {
      try {
        const res = await customerApi.submitForgotOtp(email, v.otp);
        setResetToken(res.data);
        setStep('password');
      } catch (err) {
        if (/incorrect|expired/i.test(err.message)) {
          const msg = /expired/i.test(err.message)
            ? 'This OTP has expired. Request a new one.'
            : /left|too many|request/i.test(err.message)
              ? err.message
              : 'That OTP is wrong.';
          otpForm.setFieldError('otp', msg);
          notifyError(msg);
          return;
        }
        throw err;
      }
    });

  const savePassword = (v) =>
    run(async () => {
      try {
        await customerApi.resetPassword(email, v.password, resetToken);
      } catch (err) {
        if (err.status === 401) {
          // the 10-minute reset window has passed: start again from the email step
          setResetToken(null);
          setStep('email');
          notifyError('This reset has expired. Ask for a new OTP and try again.');
          return;
        }
        throw err;
      }
      notify('Password changed. Log in with your new password. Other devices have been logged out.', 'success');
      navigate('/login');
    });

  const progress = (
    <ol className="d-flex gap-2 list-unstyled mb-4" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className={`flex-fill rounded-pill ${STEPS.indexOf(step) >= i ? 'bg-accent' : 'bg-secondary-subtle'}`} style={{ height: 6 }}>
          <span className="visually-hidden">
            Step {i + 1} {STEPS.indexOf(step) >= i ? '(done or current)' : ''}
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <AuthLayout>
      {step === 'email' && (
        <Panel title="Reset your password" icon="bi-key" intro="We’ll email an OTP to the address on your account.">
          {progress}
          <form ref={emailForm.formRef} onSubmit={emailForm.submit(sendOtp)} className="vstack gap-3" noValidate>
            <Input label="Account email" type="email" autoComplete="email" {...emailForm.bind('email')} />
            <Button busy={busy} busyText="Sending OTP…" type="submit" variant="accent" size="lg">
              Send OTP
            </Button>
          </form>
        </Panel>
      )}

      {step === 'otp' && (
        <Panel
          title="Enter your OTP"
          icon="bi-envelope-check"
          intro={`We emailed it to ${email}. It expires after 5 minutes. Check your spam folder if you can’t find it.`}
        >
          {progress}
          <form ref={otpForm.formRef} onSubmit={otpForm.submit(checkOtp)} className="vstack gap-3" noValidate>
            <Input
              label="OTP"
              inputClassName="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              {...otpForm.bind('otp', { transform: digits(6) })}
            />
            <Button busy={busy} busyText="Checking…" type="submit" variant="accent" size="lg">
              Confirm OTP
            </Button>
            <Button type="button" variant="link" className="p-0 align-self-start" onClick={() => setStep('email')}>
              Use a different email
            </Button>
          </form>
        </Panel>
      )}

      {step === 'password' && (
        <Panel title="Choose a new password" icon="bi-shield-lock" intro="You have 10 minutes to finish this step.">
          {progress}
          <form ref={pwForm.formRef} onSubmit={pwForm.submit(savePassword)} className="vstack gap-3" noValidate>
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters, with a letter and a number."
              {...pwForm.bind('password')}
            />
            <PasswordInput label="Repeat new password" autoComplete="new-password" {...pwForm.bind('confirm')} />
            <Button busy={busy} busyText="Saving…" type="submit" variant="accent" size="lg">
              Change password
            </Button>
          </form>
        </Panel>
      )}

      <p className="text-center small mt-3">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
