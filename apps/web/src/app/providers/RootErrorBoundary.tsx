import { Component, type ErrorInfo, type ReactNode } from 'react';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence: catches render errors that escape route-level error
 * boundaries. Deliberately renders plain markup — if the theme or i18n layer
 * is what crashed, this fallback must still work.
 */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  override state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Uncaught render error', error, { componentStack: errorInfo.componentStack });
  }

  override render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          maxWidth: 480,
          margin: '15vh auto',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 22 }}>Application error</h1>
        <p style={{ color: '#555' }}>An unexpected error occurred. Reloading the page may help.</p>
        {env.DEV && (
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b00020', fontSize: 13 }}>
            {this.state.error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
