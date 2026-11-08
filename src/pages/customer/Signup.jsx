import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { customerApi } from '../../api.js';
import { useAction, useSession } from '../../session.jsx';
import { Button, Field, Input, Panel, PasswordInput, Select } from '../../components/ui.jsx';
import useForm, { digits } from '../../useForm.js';
import { rules } from '../../validate.js';
import AuthLayout from './AuthLayout.jsx';

const INITIAL = { name: '', email: '', mobile: '', password: '', confirm: '', age: '', gender: '', address: '', photo: null };

const schema = (v) => ({
  name: rules.personName,
  email: rules.email,
  mobile: rules.mobile,
  password: rules.newPassword,
  confirm: rules.confirm(v.password),
  age: rules.age,
  gender: rules.required('your gender'),
  address: rules.address,
  photo: rules.photo,
});

export default function Signup() {
  const { notify, notifyError } = useSession();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const form = useForm(INITIAL, schema);
  const [preview, setPreview] = useState('');

  const pickPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    form.setValue('photo', file);
    setPreview(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
  };

  const send = (v) =>
    run(async () => {
      const fd = new FormData();
      ['name', 'email', 'mobile', 'password', 'age', 'gender', 'address'].forEach((k) => fd.append(k, String(v[k]).trim()));
      fd.append('pic', v.photo);
      try {
        await customerApi.signup(fd);
      } catch (err) {
        // Backend: "Email or Mobile should not be repeated"
        if (/repeat|already|exist/i.test(err.message)) {
          const msg = 'This email or mobile number is already registered.';
          form.setFieldError('mobile', msg);
          form.setFieldError('email', msg);
          notifyError('An account with this email or mobile number already exists. Log in, or use a different email and mobile number.');
          return;
        }
        throw err;
      }
      notify('Account created. Check your email for the OTP.', 'success');
      navigate('/verify', { state: { email: v.email.trim() } });
    });

  return (
    <AuthLayout wide>
      <Panel title="Create a passenger account" icon="bi-person-plus" intro="We’ll email you a one-time code to confirm it’s you.">
        <form ref={form.formRef} onSubmit={form.submit(send)} noValidate>
          <Row className="g-3">
            <Col md={6}>
              <Input label="Full name" autoComplete="name" {...form.bind('name')} />
            </Col>
            <Col md={6}>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                hint="You’ll log in with this. Each email can have one account."
                {...form.bind('email')}
              />
            </Col>
            <Col md={6}>
              <Input
                label="Mobile number"
                inputMode="numeric"
                autoComplete="tel-national"
                hint="10 digits. Each number can have one account."
                {...form.bind('mobile', { transform: digits(10) })}
              />
            </Col>
            <Col xs={6} md={3}>
              <Input label="Age" inputMode="numeric" {...form.bind('age', { transform: digits(3) })} />
            </Col>
            <Col xs={6} md={3}>
              <Select label="Gender" {...form.bind('gender')}>
                <option value="" disabled>
                  Choose
                </option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Col>
            <Col md={6}>
              <PasswordInput
                label="Password"
                autoComplete="new-password"
                hint="At least 8 characters, with a letter and a number."
                {...form.bind('password')}
              />
            </Col>
            <Col md={6}>
              <PasswordInput label="Repeat password" autoComplete="new-password" {...form.bind('confirm')} />
            </Col>
            <Col xs={12}>
              <Field label="Address" error={form.errors.address}>
                <Form.Control
                  as="textarea"
                  rows={2}
                  autoComplete="street-address"
                  aria-label="Address"
                  isInvalid={!!form.errors.address}
                  {...form.bind('address', { native: true })}
                />
              </Field>
            </Col>
            <Col xs={12}>
              <Field label="Profile photo" error={form.errors.photo} hint="JPG, PNG or WebP, up to 5 MB.">
                <div className="d-flex align-items-center gap-3">
                  {preview ? <img src={preview} alt="" className="photo-preview" /> : <span className="photo-preview d-inline-block" aria-hidden="true" />}
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={pickPhoto}
                    aria-label="Profile photo"
                    isInvalid={!!form.errors.photo}
                    aria-invalid={form.errors.photo ? 'true' : undefined}
                  />
                </div>
              </Field>
            </Col>
            <Col xs={12} className="d-grid">
              <Button busy={busy} busyText="Creating account…" type="submit" variant="accent" size="lg">
                Create account
              </Button>
            </Col>
          </Row>
        </form>
        <p className="text-secondary small mt-4 mb-0">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Panel>
    </AuthLayout>
  );
}
