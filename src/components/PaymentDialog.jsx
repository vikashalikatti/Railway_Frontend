import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import { customerApi } from '../api.js';
import { useSession } from '../session.jsx';
import { Button, ErrorNote, Input, Select, rupees } from './ui.jsx';

const METHODS = [
  { id: 'CARD', label: 'Card', icon: 'bi-credit-card' },
  { id: 'UPI', label: 'UPI', icon: 'bi-phone' },
  { id: 'NETBANKING', label: 'Net banking', icon: 'bi-bank' },
];

/** "4111111111111111" -> "4111 1111 1111 1111" */
const groupCard = (v) =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

/**
 * Test payment gateway: card (OTP 123456), UPI or net banking. No real money moves.
 * Calls onPaid(payment) once the payment is PAID; the booking is then made with payment.id.
 */
export default function PaymentDialog({ show, amount, onPaid, onCancel }) {
  const { session } = useSession();
  const [method, setMethod] = useState('CARD');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upi, setUpi] = useState('');
  const [bank, setBank] = useState('');
  const [banks, setBanks] = useState([]);
  const [payment, setPayment] = useState(null); // PENDING payment waiting for OTP / approval
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) return;
    setPayment(null);
    setOtp('');
    setError('');
    customerApi
      .banks()
      .then((r) => setBanks(r.data2 || []))
      .catch(() => setBanks([]));
  }, [show]);

  const go = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'The payment didn’t go through. Try again.');
      if (err.body?.data2?.status === 'FAILED') setPayment(null);
    } finally {
      setBusy(false);
    }
  };

  const start = (e) => {
    e.preventDefault();
    go(async () => {
      const body =
        method === 'CARD'
          ? { amount, method, cardNumber: card.number.replace(/\s/g, ''), expiry: card.expiry, cvv: card.cvv, nameOnCard: card.name }
          : method === 'UPI'
            ? { amount, method, upiId: upi.trim() }
            : { amount, method, bank };
      const res = await customerApi.startPayment(session.token, body);
      setPayment(res.data2);
    });
  };

  const confirm = (approve) =>
    go(async () => {
      const res = await customerApi.confirmPayment(session.token, payment.id, method === 'CARD' ? { otp: otp.trim() } : { approve });
      if (res.data2?.status === 'PAID') onPaid(res.data2);
      else setPayment(res.data2);
    });

  const field = (k) => ({ value: card[k], onChange: (e) => setCard((c) => ({ ...c, [k]: e.target.value })) });

  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered backdrop="static" aria-labelledby="pay-title">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="pay-title" className="h5">
          Pay {rupees(amount)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="vstack gap-3">
        <p className="pay-test-note mb-0">
          <i className="bi bi-cone-striped me-1" aria-hidden="true" />
          Test payment: no money moves. Card <code>4111 1111 1111 1111</code>, any future expiry and CVV, OTP <code>123456</code>. To see a
          failure, use card <code>4000 0000 0000 0002</code> or UPI <code>failure@upi</code>.
        </p>

        {!payment ? (
          <>
            <Nav variant="pills" activeKey={method} onSelect={(k) => setMethod(k)} className="gap-1" role="tablist">
              {METHODS.map((m) => (
                <Nav.Item key={m.id}>
                  <Nav.Link eventKey={m.id} role="tab" aria-selected={method === m.id}>
                    <i className={`bi ${m.icon} me-1`} aria-hidden="true" />
                    {m.label}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
            <form onSubmit={start} className="vstack gap-3" noValidate>
              {method === 'CARD' && (
                <>
                  <Input
                    label="Card number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={23}
                    value={card.number}
                    onChange={(e) => setCard((c) => ({ ...c, number: groupCard(e.target.value) }))}
                  />
                  <div className="d-flex gap-3">
                    <Input
                      label="Expiry (MM/YY)"
                      autoComplete="cc-exp"
                      maxLength={5}
                      placeholder="12/28"
                      className="flex-fill"
                      {...field('expiry')}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCard((c) => ({ ...c, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                      }}
                    />
                    <Input label="CVV" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} className="flex-fill" {...field('cvv')} />
                  </div>
                  <Input label="Name on card" autoComplete="cc-name" maxLength={50} {...field('name')} />
                </>
              )}
              {method === 'UPI' && (
                <Input label="UPI id" placeholder="name@bank" maxLength={64} value={upi} onChange={(e) => setUpi(e.target.value)} />
              )}
              {method === 'NETBANKING' && (
                <Select label="Your bank" value={bank} onChange={(e) => setBank(e.target.value)}>
                  <option value="">Choose your bank</option>
                  {banks.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </Select>
              )}
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" variant="accent" busy={busy} busyText="Contacting the bank…" className="w-100">
                <i className="bi bi-lock" aria-hidden="true" />
                Pay {rupees(amount)}
              </Button>
            </form>
          </>
        ) : (
          <div className="vstack gap-3">
            <p className="mb-0">
              <strong>{payment.instrument}</strong>
              <br />
              <span className="text-secondary">{payment.nextStep}</span>
            </p>
            {method === 'CARD' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  confirm(true);
                }}
                className="vstack gap-3"
                noValidate
              >
                <Input
                  label="OTP"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
                <ErrorNote>{error}</ErrorNote>
                <Button type="submit" variant="accent" busy={busy} busyText="Checking…" disabled={otp.length !== 6}>
                  Confirm payment
                </Button>
              </form>
            ) : (
              <>
                <ErrorNote>{error}</ErrorNote>
                <div className="d-flex gap-2">
                  <Button variant="accent" busy={busy} busyText="Approving…" onClick={() => confirm(true)} className="flex-fill">
                    {method === 'UPI' ? 'Approve in UPI app' : 'Approve on bank page'}
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => confirm(false)}>
                    Decline
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
