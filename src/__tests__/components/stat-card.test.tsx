import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/dashboard/stat-card";
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
    render(
      <StatCard title="Total" value={10} description="All managed nodes" />,
    );
    expect(screen.getByText("All managed nodes")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(
      <StatCard title="Nodes" value={3} icon={Server} />,
    );
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it("renders without icon", () => {
    render(<StatCard title="Nodes" value={3} />);
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("renders positive trend", () => {
    render(
      <StatCard
        title="Sessions"
        value={150}
        trend={{ value: 12, label: "from last hour" }}
      />,
    );
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText("from last hour")).toBeInTheDocument();
  });

  it("renders negative trend", () => {
    render(
      <StatCard
        title="Sessions"
        value={100}
        trend={{ value: -5, label: "from last hour" }}
      />,
    );
    expect(screen.getByText("-5%")).toBeInTheDocument();
  });

  it("renders zero trend", () => {
    render(
      <StatCard
        title="Sessions"
        value={100}
        trend={{ value: 0, label: "unchanged" }}
      />,
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <StatCard title="Test" value={1} className="custom-stat" />,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("custom-stat");
  });
});
