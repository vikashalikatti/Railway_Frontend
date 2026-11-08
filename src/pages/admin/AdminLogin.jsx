import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Panel, PasswordInput } from '../../components/ui.jsx';
import useForm from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from '../customer/AuthLayout.jsx';

const schema = () => ({ name: rules.required('the admin name'), password: rules.required('the password') });

export default function AdminLogin() {
  const { login, notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const form = useForm({ name: '', password: '' }, schema);

  const send = (v) =>
    run(async () => {
      try {
        const res = await adminApi.login(v.name.trim(), v.password);
        login({ role: 'admin', token: res.data, name: v.name.trim() });
        notify('Logged in as admin.', 'success', 'Welcome back');
        navigate('/console');
      } catch (err) {
        if (/wrong admin name or password|no user|bad credentials/i.test(err.message)) {
          form.setFieldError('password', 'Wrong admin name or password.');
          notifyError('Wrong admin name or password. Try again.');
          return;
        }
        throw err;
      }
    });

  return (
    <AuthLayout>
      <Panel title="Admin log in" icon="bi-shield-lock" intro="Manage trains, timetables, fares and coaches.">
        <form ref={form.formRef} onSubmit={form.submit(send)} className="vstack gap-3" noValidate>
          <Input label="Admin name" autoComplete="username" {...form.bind('name')} />
          <PasswordInput label="Password" autoComplete="current-password" {...form.bind('password')} />
          <Button busy={busy} busyText="Logging in…" type="submit" size="lg">
            Log in
          </Button>
        </form>
        <p className="small text-secondary mt-4 mb-0">
          First time setting up? <Link to="/console/create">Create the admin account</Link>
        </p>
      </Panel>
    </AuthLayout>
  );
}
