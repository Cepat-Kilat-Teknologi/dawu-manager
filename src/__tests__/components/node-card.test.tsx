import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeCard } from "@/components/dashboard/node-card";

describe("NodeCard", () => {
  const defaultProps = {
    id: "node-1",
    name: "bng-jakarta-1",
    url: "http://192.168.1.10:8470",
    status: "online",
  };

  it("renders node name", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.getByText("bng-jakarta-1")).toBeInTheDocument();
  });

  it("renders host:port derived from the URL", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.getByText("192.168.1.10:8470")).toBeInTheDocument();
  });

  it("falls back to the raw string for an unparseable URL", () => {
    render(<NodeCard {...defaultProps} url="not a url" />);
    expect(screen.getByText("not a url")).toBeInTheDocument();
  });

  it("falls back to the raw string when the URL has no host", () => {
    render(<NodeCard {...defaultProps} url="file:///local" />);
    expect(screen.getByText("file:///local")).toBeInTheDocument();
  });

  it("uses the unknown LED style for an unrecognized status", () => {
    render(<NodeCard {...defaultProps} status="maintenance" />);
    // Status badge falls back to "Unknown" for unknown statuses.
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("links to the node detail page", () => {
    render(<NodeCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/nodes/node-1");
  });

  it("renders the status badge", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("renders location when provided", () => {
    render(<NodeCard {...defaultProps} location="Jakarta DC" />);
    expect(screen.getByText("Jakarta DC")).toBeInTheDocument();
  });

  it("shows placeholder when no location", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.getByText("No location set")).toBeInTheDocument();
  });

  it("renders CPU and RAM usage bars", () => {
    render(<NodeCard {...defaultProps} cpu={40} ram={70} />);
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("RAM")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("clamps out-of-range usage values", () => {
    render(<NodeCard {...defaultProps} cpu={150} ram={-10} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders the session count badge", () => {
    render(<NodeCard {...defaultProps} sessions={12} />);
    expect(screen.getByText("12 sess")).toBeInTheDocument();
  });

  it("defaults sessions to 0", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.getByText("0 sess")).toBeInTheDocument();
  });

  it("renders a sparkline", () => {
    render(<NodeCard {...defaultProps} sparkline={[1, 5, 3, 8]} />);
    expect(screen.getByTestId("node-sparkline")).toBeInTheDocument();
  });

  it("renders uptime, last seen and tags when provided", () => {
    render(
      <NodeCard
        {...defaultProps}
        uptime="2d 5h"
        lastSeen="2026-07-09T10:00:00Z"
        tags={["prod", "jkt"]}
      />,
    );
    expect(screen.getByText("Up 2d 5h")).toBeInTheDocument();
    expect(screen.getByText(/Last seen:/)).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getByText("jkt")).toBeInTheDocument();
  });

  it("renders the meta row with only uptime (no lastSeen or tags)", () => {
    render(<NodeCard {...defaultProps} uptime="3h" />);
    expect(screen.getByText("Up 3h")).toBeInTheDocument();
    expect(screen.queryByText(/Last seen:/)).not.toBeInTheDocument();
  });

  it("treats an empty tags array as no tags", () => {
    render(<NodeCard {...defaultProps} tags={[]} />);
    expect(screen.queryByText(/Last seen:/)).not.toBeInTheDocument();
  });

  it("omits the meta row when no uptime/lastSeen/tags", () => {
    render(<NodeCard {...defaultProps} />);
    expect(screen.queryByText(/Last seen:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Up /)).not.toBeInTheDocument();
  });

  it("fires onRestart and stops propagation from the restart action", () => {
    const onRestart = vi.fn();
    render(<NodeCard {...defaultProps} onRestart={onRestart} />);
    fireEvent.click(screen.getByLabelText("Restart node"));
    expect(onRestart).toHaveBeenCalled();
  });

  it("has a settings quick action", () => {
    render(<NodeCard {...defaultProps} />);
    const settings = screen.getByLabelText("Node settings");
    fireEvent.click(settings);
    expect(settings).toBeInTheDocument();
  });
});
