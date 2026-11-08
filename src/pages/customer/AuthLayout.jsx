/** Centred card layout for the account pages */
export default function AuthLayout({ children, wide = false }) {
  return (
    <div className="container py-4 py-md-5">
      <div className="mx-auto" style={{ maxWidth: wide ? 720 : 480 }}>
        {children}
      </div>
    </div>
  );
}
