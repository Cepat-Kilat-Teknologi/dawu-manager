import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  StatCard,
  StatCardSkeleton,
  sparklinePoints,
} from "@/components/dashboard/stat-card";
import { Server } from "lucide-react";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Nodes" value={5} />);
    expect(screen.getByText("Total Nodes")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard title="Status" value="Healthy" />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<StatCard title="Total" value={10} description="All managed nodes" />);
    expect(screen.getByText("All managed nodes")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(<StatCard title="Nodes" value={3} icon={Server} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("renders each variant", () => {
    for (const variant of ["default", "success", "warning", "danger"] as const) {
      const { unmount } = render(
        <StatCard title="V" value={1} icon={Server} variant={variant} />,
      );
      unmount();
    }
    expect(true).toBe(true);
  });

  it("renders without icon", () => {
    render(<StatCard title="Nodes" value={3} />);
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("renders positive trend with up arrow", () => {
    render(
      <StatCard title="Sessions" value={150} trend={{ value: 12, label: "from last hour" }} />,
    );
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText("from last hour")).toBeInTheDocument();
  });

  it("renders negative trend", () => {
    render(<StatCard title="Sessions" value={100} trend={{ value: -5 }} />);
    expect(screen.getByText("-5%")).toBeInTheDocument();
  });

  it("renders zero trend", () => {
    render(<StatCard title="Sessions" value={100} trend={{ value: 0, label: "unchanged" }} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("unchanged")).toBeInTheDocument();
  });

  it("renders a sparkline when data is provided", () => {
    render(<StatCard title="Traffic" value={10} sparkline={[1, 4, 2, 8]} />);
    expect(screen.getByTestId("stat-sparkline")).toBeInTheDocument();
  });

  it("ignores an empty sparkline array", () => {
    render(<StatCard title="Traffic" value={10} sparkline={[]} />);
    expect(screen.queryByTestId("stat-sparkline")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<StatCard title="Test" value={1} className="custom-stat" />);
    expect(screen.getByTestId("card").className).toContain("custom-stat");
  });
});

describe("sparklinePoints", () => {
  it("returns an empty string for no data", () => {
    expect(sparklinePoints([])).toBe("");
  });

  it("returns a flat line for a single point", () => {
    expect(sparklinePoints([5], 100, 32)).toBe("0,16 100,16");
  });

  it("maps a series across the viewbox", () => {
    const points = sparklinePoints([0, 10], 100, 32);
    expect(points).toBe("0.0,32.0 100.0,0.0");
  });

  it("handles a flat series (zero range)", () => {
    const points = sparklinePoints([5, 5, 5]);
    // All values equal → range defaults to 1, so all points sit on the baseline.
    expect(points).toContain("0.0,32.0");
  });
});

describe("StatCardSkeleton", () => {
  it("renders shimmer placeholders", () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
  });

  it("merges a custom className", () => {
    render(<StatCardSkeleton className="sk-custom" />);
    expect(screen.getByTestId("card").className).toContain("sk-custom");
  });
});
