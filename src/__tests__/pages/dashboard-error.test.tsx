import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "@/app/(dashboard)/error";

describe("DashboardError", () => {
  it("renders error message", () => {
    const error = new Error("Something broke");
    render(<DashboardError error={error} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows error digest when available", () => {
    const error = Object.assign(new Error("fail"), { digest: "abc123" });
    render(<DashboardError error={error} reset={vi.fn()} />);
    expect(screen.getByText(/Error ID: abc123/)).toBeInTheDocument();
  });

  it("calls reset when Try again clicked", () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs error to console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test error");
    render(<DashboardError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("Dashboard error:", error);
    spy.mockRestore();
  });
});
