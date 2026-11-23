"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps the rest of the screen safe from one module: when something a module draws throws, the
 * fallback takes its place and nothing else stops. A new plan version gives it another go.
 */
export class ModuleBoundary extends Component<
  { resetKey: number; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("A module failed to render", error);
  }

  componentDidUpdate(previous: { resetKey: number }) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
