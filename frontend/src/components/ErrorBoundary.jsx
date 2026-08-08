import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error?.message || error, errorInfo?.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg border border-red-100 m-4">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-red-500">
            We encountered an unexpected error. Please try refreshing the page or come back later.
          </p>
          {this.state.error && (
            <pre className="mt-4 p-4 bg-red-100 text-red-800 rounded text-left overflow-auto max-w-full text-xs font-mono">
              <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
              {this.state.errorInfo?.componentStack && (
                <>
                  <br /><br />
                  <strong>Stack:</strong> {this.state.errorInfo.componentStack}
                </>
              )}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
