import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PanelBoundary } from "./panel-boundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("PanelBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <PanelBoundary>
        <p>fine</p>
      </PanelBoundary>,
    );

    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("catches a render crash and shows a fallback instead of unmounting the tree", () => {
    // React logs the caught error to the console by default; silence it for
    // this one expected-crash test only, mirroring the standard pattern for
    // deliberately exercising an error boundary.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PanelBoundary>
        <Bomb />
      </PanelBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);

    consoleError.mockRestore();
  });

  it("isolates a crash to its own boundary — a sibling boundary's content survives", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <div>
        <PanelBoundary>
          <Bomb />
        </PanelBoundary>
        <PanelBoundary>
          <p>sibling content</p>
        </PanelBoundary>
      </div>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByText("sibling content")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
