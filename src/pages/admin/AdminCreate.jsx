import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import { adminApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Input, Panel, PasswordInput } from '../../components/ui.jsx';
import useForm from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from '../customer/AuthLayout.jsx';

const schema = (v) => ({
  name: rules.adminName,
  email: rules.email,
  password: rules.newPassword,
  confirm: rules.confirm(v.password),
});

export default function AdminCreate() {
  const { notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [exists, setExists] = useState(false);
  const form = useForm({ name: '', email: '', password: '', confirm: '' }, schema);

  const send = (v) => {
    setExists(false);
    run(async () => {
      try {
        await adminApi.create({ name: v.name.trim(), email: v.email.trim(), password: v.password });
      } catch (err) {
        // 208 Already Reported: the backend allows only one admin
        if (err.status === 208) {
          setExists(true);
          notifyError('An admin account already exists, and only one is allowed.');
          return;
        }
        throw err;
      }
      notify('Admin account created. Log in to continue.', 'success');
      navigate('/console/login');
    });
  };

  return (
    <AuthLayout>
      <Panel
        title="Create the admin account"
        icon="bi-person-gear"
        intro="There can only be one admin. You log in with the admin name, not the email."
      >
        <form ref={form.formRef} onSubmit={form.submit(send)} className="vstack gap-3" noValidate>
          <Input label="Admin name" autoComplete="username" hint="3 to 30 letters or numbers, no spaces." {...form.bind('name')} />
          <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            {...form.bind('password')}
          />
          <PasswordInput label="Repeat password" autoComplete="new-password" {...form.bind('confirm')} />
          {exists && (
            <Alert variant="danger" className="mb-0">
              An admin account already exists. <Alert.Link as={Link} to="/console/login">Log in as admin</Alert.Link> with that account instead.
            </Alert>
          )}
          <Button busy={busy} busyText="Creating…" type="submit" size="lg">
            Create admin account
          </Button>
        </form>
        <p className="small mt-4 mb-0">
          <Link to="/console/login">Back to admin log in</Link>
        </p>
      </Panel>
    </AuthLayout>
  );
}
