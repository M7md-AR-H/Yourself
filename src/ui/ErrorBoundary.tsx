import { Component, type ReactNode } from 'react';

/** Last line of defence: a render crash shows a way out instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="onb" style={{ justifyContent: 'center' }}>
        <h1 className="display h-hero">Something broke.</h1>
        <p className="subtitle">Your data is still on this phone. Try reloading. If it keeps happening, export a backup from Settings and send me the message below.</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--muted)' }}>{this.state.error.message}</pre>
        <button className="btn btn-solid btn-block" onClick={() => { location.hash = '#/today'; location.reload(); }}>Reload</button>
      </main>
    );
  }
}
