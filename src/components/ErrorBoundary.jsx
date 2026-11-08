import { Component } from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

/**
 * If a page crashes while rendering, show a friendly "Something went wrong" card
 * (and a toast) instead of a blank screen. `onError` is called with the error.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error(error, info);
    this.props.onError?.(error);
  }

  componentDidUpdate(prev) {
    // Moving to another page clears the error
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container py-5" style={{ maxWidth: 520 }}>
        <Card className="shadow-sm text-center">
          <Card.Body className="p-4 p-md-5">
            <i className="bi bi-exclamation-octagon text-danger" style={{ fontSize: '2.5rem' }} aria-hidden="true" />
            <h1 className="h4 mt-3">Something went wrong</h1>
            <p className="text-secondary mb-4">This page hit a problem. Reloading usually fixes it.</p>
            <div className="d-flex gap-2 justify-content-center">
              <Button variant="primary" onClick={() => window.location.reload()}>
                Reload page
              </Button>
              <Button variant="outline-primary" href="/">
                Go to home
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }
}
