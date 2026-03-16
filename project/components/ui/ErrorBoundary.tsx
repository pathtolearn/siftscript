import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) {
      return children;
    }

    if (fallback !== undefined) {
      return typeof fallback === 'function' ? fallback(error, this.reset) : fallback;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <div>
          <h3 className="text-sm font-medium text-red-800">Something went wrong</h3>
          <p className="mt-1 text-xs text-red-600">{error.message}</p>
        </div>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }
}
