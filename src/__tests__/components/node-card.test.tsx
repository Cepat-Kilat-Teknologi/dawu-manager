import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders node URL", () => {
    render(<NodeCard {...defaultProps} />);
    expect(
      screen.getByText("http://192.168.1.10:8470"),
    ).toBeInTheDocument();
  });

  it("links to node detail page", () => {
    render(<NodeCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/nodes/node-1");
  });

  it("renders status badge", () => {
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

  it("renders lastSeen when provided", () => {
    render(
      <NodeCard
        {...defaultProps}
        lastSeen="2026-07-09T10:00:00Z"
      />,
    );
    expect(screen.getByText(/Last seen:/)).toBeInTheDocument();
  });

  it("does not render lastSeen when null", () => {
    render(<NodeCard {...defaultProps} lastSeen={null} />);
    expect(screen.queryByText(/Last seen:/)).not.toBeInTheDocument();
  });
});
