import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Dropdown from 'react-bootstrap/Dropdown';
import SplitButton from 'react-bootstrap/SplitButton';
import { onLoadingChange } from './api.js';
import { useSession } from './session.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginModal from './components/LoginModal.jsx';
import { Button } from './components/ui.jsx';
import Home from './pages/customer/Home.jsx';
import Login from './pages/customer/Login.jsx';
import Signup from './pages/customer/Signup.jsx';
import VerifyOtp from './pages/customer/VerifyOtp.jsx';
import ForgotPassword from './pages/customer/ForgotPassword.jsx';
import Search from './pages/customer/Search.jsx';
import MyBookings from './pages/customer/MyBookings.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminCreate from './pages/admin/AdminCreate.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminChart from './pages/admin/AdminChart.jsx';
import ChartVacancy from './pages/customer/ChartVacancy.jsx';

function RequireAdmin({ children }) {
  const { session } = useSession();
  if (!session || session.role !== 'admin') return <Navigate to="/console/login" replace />;
  return children;
}

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#f47b20" />
      <rect x="11" y="10" width="18" height="16" rx="4" fill="#fff" />
      <rect x="14" y="13" width="12" height="6" rx="1.5" fill="#1b3a73" />
      <circle cx="15.5" cy="22.5" r="1.6" fill="#1b3a73" />
      <circle cx="24.5" cy="22.5" r="1.6" fill="#1b3a73" />
      <path d="M13 26l-3 5M27 26l3 5M12 30h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Thin moving bar under the navbar while any request to the backend is running */
function LoadingBar() {
  const [loading, setLoading] = useState(false);
  useEffect(() => onLoadingChange(setLoading), []);
  return (
    <div className={`loading-bar ${loading ? 'is-on' : ''}`} role="progressbar" aria-hidden={!loading} aria-label="Loading">
      <span />
    </div>
  );
}

function Header() {
  const { session, logout, askLogin, notify } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const onTrains = pathname === '/' || pathname.startsWith('/trains');

  useEffect(() => setOpen(false), [pathname]);

  const signOut = (everywhere = false) => {
    const wasAdmin = session?.role === 'admin';
    logout({ everywhere });
    if (everywhere) notify('Logged out on every device.', 'success');
    navigate(wasAdmin ? '/console/login' : '/');
  };

  return (
    <Navbar bg="primary" variant="dark" expand="md" sticky="top" className="app-navbar py-2" expanded={open} onToggle={setOpen}>
      <Container>
        <Navbar.Brand as={Link} to={session?.role === 'admin' ? '/console' : '/'}>
          <Logo />
          <span>
            Railway
            <small>Train ticket booking</small>
          </span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto ms-md-3">
            {session?.role === 'admin' ? (
              <>
                <Nav.Link as={NavLink} to="/console" end>
                  <i className="bi bi-train-front me-1" aria-hidden="true" />
                  Manage trains
                </Nav.Link>
                <Nav.Link as={NavLink} to="/console/chart">
                  <i className="bi bi-clipboard-data me-1" aria-hidden="true" />
                  Charts
                </Nav.Link>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/" className={onTrains ? 'active' : ''}>
                  <i className="bi bi-search me-1" aria-hidden="true" />
                  Book tickets
                </Nav.Link>
                <Nav.Link as={NavLink} to="/chart">
                  <i className="bi bi-clipboard-check me-1" aria-hidden="true" />
                  Chart &amp; vacancy
                </Nav.Link>
                {session?.role === 'customer' && (
                  <Nav.Link as={NavLink} to="/bookings">
                    <i className="bi bi-ticket-perforated me-1" aria-hidden="true" />
                    My bookings
                  </Nav.Link>
                )}
              </>
            )}
          </Nav>
          <div className="d-flex flex-wrap align-items-center gap-2 py-2 py-md-0">
            {session ? (
              <>
                <span className="text-white-50 small text-truncate" style={{ maxWidth: 220 }}>
                  <i className="bi bi-person-circle me-1" aria-hidden="true" />
                  {session.role === 'admin' ? `Admin: ${session.name}` : session.email}
                </span>
                <SplitButton
                  id="logout-menu"
                  variant="outline-light"
                  size="sm"
                  title="Log out"
                  align="end"
                  toggleLabel="More log-out options"
                  onClick={() => signOut(false)}
                >
                  <Dropdown.Item as="button" onClick={() => signOut(true)}>
                    <i className="bi bi-phone me-2" aria-hidden="true" />
                    Log out on all devices
                  </Dropdown.Item>
                </SplitButton>
              </>
            ) : (
              <>
                <Button variant="outline-light" size="sm" onClick={() => askLogin()}>
                  Log in
                </Button>
                <Button variant="accent" size="sm" as={Link} to="/signup">
                  Register
                </Button>
              </>
            )}
          </div>
        </Navbar.Collapse>
      </Container>
      <LoadingBar />
    </Navbar>
  );
}

function Footer() {
  return (
    <footer className="app-footer mt-auto">
      <Container className="py-4 d-flex flex-wrap justify-content-between gap-3">
        <span>
          <i className="bi bi-train-front me-1" aria-hidden="true" />
          Railway, train ticket booking
        </span>
        <nav aria-label="Footer" className="d-flex flex-wrap gap-4">
          <Link to="/">Book tickets</Link>
          <Link to="/bookings">My bookings</Link>
          <Link to="/chart">Chart &amp; vacancy</Link>
          <Link to="/forgot">Reset password</Link>
          <Link to="/console/login">Admin</Link>
        </nav>
      </Container>
    </footer>
  );
}

export default function App() {
  const { loginPrompt, closeLogin, notifyError } = useSession();
  const { pathname } = useLocation();
  return (
    <>
      <Header />
      <main className="app-main">
        <ErrorBoundary resetKey={pathname} onError={() => notifyError()}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trains" element={<Search />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/chart" element={<ChartVacancy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<VerifyOtp />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/console/login" element={<AdminLogin />} />
            <Route path="/console/create" element={<AdminCreate />} />
            <Route
              path="/console"
              element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              }
            />
            <Route
              path="/console/chart"
              element={
                <RequireAdmin>
                  <AdminChart />
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <LoginModal open={!!loginPrompt} reason={loginPrompt?.reason} onSuccess={loginPrompt?.onSuccess} onClose={closeLogin} />
    </>
  );
}
