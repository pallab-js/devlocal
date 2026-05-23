import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    console.error("[ErrorBoundary]", error);
    return { error };
  }

  handleCopy = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(
        `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ""}`
      );
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 font-mono text-[13px]" style={{ color: "var(--error)" }}>
          <div className="mb-2 font-semibold">Something went wrong</div>
          <div className="text-[12px]" style={{ color: "var(--text-3)", marginBottom: 8 }}>
            {this.state.error.message}
          </div>
          {this.state.error.stack && (
            <pre className="text-[11px] text-text-3 bg-bg-deep p-2 rounded border border-border-light max-h-[200px] overflow-auto mb-3"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {this.state.error.stack}
            </pre>
          )}
          <div className="flex gap-2">
            <button onClick={() => this.setState({ error: null })}
              className="px-3 py-1.5 rounded text-[12px] cursor-pointer font-medium"
              style={{ border: "1px solid var(--border-hi)", background: "var(--surface-2)", color: "var(--text-2)" }}>
              Retry
            </button>
            <button onClick={this.handleCopy}
              className="px-3 py-1.5 rounded text-[12px] cursor-pointer"
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)" }}>
              Copy error
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
