import { Component } from 'react';
import { trackUXError, trackUXRecovery } from '../../lib/uxTelemetry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    trackUXError({ surface: 'global', errorType: 'render', severity: 'critical' });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="border border-signal-red/30 rounded bg-exp-panel p-8 m-4">
        <h2 className="font-display text-lg tracking-widest text-signal-red uppercase mb-3">
          The expedition interface stopped
        </h2>
        <p className="font-mono text-xs text-exp-text-dim mb-4 break-all max-w-2xl">
          {this.state.error?.message || 'This view could not finish rendering. Retry the view, then reload if the problem continues.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              trackUXRecovery({ surface: 'global', recovery: 'retry' });
              this.setState({ hasError: false, error: null });
            }}
            className="px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                       hover:bg-compass/20 hover:border-compass/60 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              trackUXRecovery({ surface: 'global', recovery: 'alternate-path' });
              window.location.reload();
            }}
            className="px-4 py-2 bg-exp-dark border border-exp-border rounded text-exp-text-dim text-xs font-mono tracking-widest uppercase
                       hover:bg-exp-surface hover:border-exp-border transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
