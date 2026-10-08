import React from "react";
import { ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { Button } from "./Button";

type ErrorBoundaryProps = {
  /** Label shown in the fallback, e.g. "Discover". */
  name: string;
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render crashes inside one view so a single broken component can't
 * whitescreen the whole app. The rest of the navigation keeps working.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Visible in devtools and production log drains; never shown to users.
    console.error(`[ErrorBoundary:${this.props.name}]`, error);
  }

  private retry = () => this.setState({ error: null });

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" className="toon-card paper-note rounded-lg p-10 text-center">
          <WarningCircle size={36} weight="duotone" className="mx-auto text-alert" />
          <h3 className="mt-3 text-xl font-black">This {this.props.name} section crashed</h3>
          <p className="mt-1 font-bold text-muted">Your work is safe — try loading it again.</p>
          <Button variant="secondary" size="small" onClick={this.retry} className="mt-5">
            <ArrowCounterClockwise size={18} weight="bold" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
