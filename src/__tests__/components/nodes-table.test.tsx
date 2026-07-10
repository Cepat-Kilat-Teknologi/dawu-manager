import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  NodesTable,
  relativeLastSeen,
  type NodeRow,
} from "@/components/nodes/nodes-table";

const nodes: NodeRow[] = [
  {
    id: "n1",
    name: "bng-jakarta-1",
    url: "http://10.0.0.1:8470",
    status: "online",
    location: "Jakarta",
    lastSeen: new Date("2020-01-01T00:00:00Z"),
  },
];

describe("relativeLastSeen", () => {
  it("returns Never for null/undefined", () => {
    expect(relativeLastSeen(null)).toBe("Never");
    expect(relativeLastSeen(undefined)).toBe("Never");
  });

  it("returns a relative string for a date", () => {
    expect(relativeLastSeen(new Date("2020-01-01T00:00:00Z"))).toMatch(/ago/);
  });
});

describe("NodesTable", () => {
  it("renders node rows with links, status, and location", () => {
    render(<NodesTable nodes={nodes} />);
    const table = screen.getByTestId("table");
    expect(within(table).getByText("bng-jakarta-1").closest("a")).toHaveAttribute(
      "href",
      "/nodes/n1",
    );
    expect(within(table).getByText("Online")).toBeInTheDocument();
    expect(within(table).getByText("Jakarta")).toBeInTheDocument();
    expect(within(table).getByText("http://10.0.0.1:8470")).toBeInTheDocument();
  });

  it("renders a dash when location is missing", () => {
    render(
      <NodesTable
        nodes={[{ ...nodes[0], location: null }]}
      />,
    );
    const table = screen.getByTestId("table");
    expect(within(table).getByText("—")).toBeInTheDocument();
  });

  it("renders the empty state with a CTA when there are no nodes", () => {
    render(<NodesTable nodes={[]} />);
    expect(screen.getByText("No nodes yet")).toBeInTheDocument();
    expect(screen.getByText("Add Node").closest("a")).toHaveAttribute(
      "href",
      "/nodes/new",
    );
  });
});
