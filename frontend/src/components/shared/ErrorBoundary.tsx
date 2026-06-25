"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-400 text-center max-w-md mb-6">
            An unexpected error occurred. You can try refreshing this section or
            return to the dashboard.
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-400/60 bg-red-500/5 rounded-lg p-3 mb-6 max-w-lg overflow-auto border border-red-500/10">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4F6EF7] text-white text-sm font-medium hover:brightness-110 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <Link
              href="/dashboard"
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A2A3A] text-gray-300 text-sm font-medium hover:bg-[#1A1A24] transition-all"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
