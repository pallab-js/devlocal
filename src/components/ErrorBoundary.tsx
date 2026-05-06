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
        <div style={{ padding: "2rem", color: "var(--error)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ color: "var(--text-3)", fontSize: 12 }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12, padding: "4px 12px", borderRadius: 4, border: "1px solid var(--border-hi)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer", fontSize: 12 }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
