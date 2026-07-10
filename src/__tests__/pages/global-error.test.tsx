import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "@/app/global-error";

describe("GlobalError", () => {
  it("renders error message", () => {
    const error = new Error("critical failure");
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<GlobalError error={new Error("fail")} reset={vi.fn()} />);
    expect(
      screen.getByText(/A critical error occurred/),
    ).toBeInTheDocument();
  });

  it("calls reset when Try again clicked", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs error to console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("global fail");
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("Global error:", error);
    spy.mockRestore();
  });
});
