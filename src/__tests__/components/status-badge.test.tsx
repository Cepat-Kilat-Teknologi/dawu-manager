import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/shared/status-badge";

describe("StatusBadge", () => {
  it("renders online status", () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("renders offline status", () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("renders degraded status", () => {
    render(<StatusBadge status="degraded" />);
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("renders unknown status", () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("falls back to unknown for invalid status", () => {
    render(<StatusBadge status="invalid-status" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows dot by default", () => {
    const { container } = render(<StatusBadge status="online" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it("hides dot when showDot=false", () => {
    const { container } = render(
      <StatusBadge status="online" showDot={false} />,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<StatusBadge status="online" className="custom-class" />);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("custom-class");
  });
});
