import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { hasError: true, message };
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-5 shadow-md">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6 max-w-xs leading-relaxed">
            An unexpected error occurred. Your training data is safe — tap below to reload.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors shadow-sm"
          >
            Reload App
          </button>
          {import.meta.env.DEV && (
            <p className="mt-4 text-xs text-red-500 font-mono max-w-sm break-all">{this.state.message}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
