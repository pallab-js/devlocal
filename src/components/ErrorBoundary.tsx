import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 font-mono text-[13px]" style={{ color: "var(--error)" }}>
          <div className="mb-2 font-semibold">Something went wrong</div>
          <div className="text-[12px]" style={{ color: "var(--text-3)" }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 px-3 py-1 rounded text-[12px] cursor-pointer"
            style={{ border: "1px solid var(--border-hi)", background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
