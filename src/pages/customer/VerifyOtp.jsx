import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Panel } from '../../components/ui.jsx';
import useForm, { digits } from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from './AuthLayout.jsx';

const schema = () => ({ email: rules.email, otp: rules.otp });
const RESEND_WAIT = 30; // seconds between "send a new OTP" clicks

export default function VerifyOtp() {
  const { state } = useLocation();
  const { notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const resend = useAction();
  const form = useForm({ email: state?.email || '', otp: '' }, schema);
  const [wait, setWait] = useState(state?.email ? RESEND_WAIT : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = (v) =>
    run(async () => {
      try {
        await customerApi.verifyOtp(v.email.trim(), v.otp);
      } catch (err) {
        if (/expired/i.test(err.message)) {
          form.setFieldError('otp', 'This OTP has expired. Send a new one below.');
          notifyError('This OTP has expired. Send a new one and try again.');
          return;
        }
        if (/incorrect|not verified/i.test(err.message)) {
          // e.g. "Incorrect OTP. 3 tries left." or "…too many times. Request a new OTP."
          const msg = /left|too many|request/i.test(err.message) ? err.message : 'That OTP is wrong. Check the latest email we sent.';
          form.setFieldError('otp', msg);
          notifyError(msg);
          return;
        }
        throw err;
      }
      notify('Email verified. You can log in now.', 'success');
      navigate('/login');
    });

  const sendNew = () => {
    const email = form.values.email.trim();
    const bad = rules.email(email);
    if (bad) {
      form.setFieldError('email', bad);
      return;
    }
    resend.run(async () => {
      await customerApi.resendOtp(email);
      notify(`New OTP sent to ${email}.`, 'success');
      form.setValue('otp', '');
      setWait(RESEND_WAIT);
    });
  };

  return (
    <AuthLayout>
      <Panel
        title="Verify your email"
        icon="bi-envelope-check"
        intro="Enter the 6-digit code we emailed you. It expires after 5 minutes. Check your spam folder if you can’t find it."
      >
        <form ref={form.formRef} onSubmit={form.submit(send)} className="vstack gap-3" noValidate>
          <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
          <Input
            label="OTP"
            inputClassName="otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...form.bind('otp', { transform: digits(6) })}
          />
          <Button busy={busy} busyText="Verifying…" type="submit" variant="accent" size="lg">
            Verify email
          </Button>
          <Button type="button" variant="outline" busy={resend.busy} busyText="Sending…" disabled={wait > 0} onClick={sendNew}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            {wait > 0 ? `Send a new OTP in ${wait}s` : 'Send a new OTP'}
          </Button>
        </form>
        <p className="small mt-4 mb-0">
          <Link to="/login">Back to log in</Link>
        </p>
      </Panel>
    </AuthLayout>
  );
}
