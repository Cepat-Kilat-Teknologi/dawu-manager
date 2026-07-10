import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@/__tests__/ui-mocks";

import DashboardLoading from "@/app/(dashboard)/loading";
import NodesLoading from "@/app/(dashboard)/nodes/loading";
import NodeDetailLoading from "@/app/(dashboard)/nodes/[nodeId]/loading";

describe("DashboardLoading", () => {
  it("renders shimmer skeletons for stats and node grid", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
  });

  it("renders skeleton tiles for the node grid", () => {
    const { getAllByTestId } = render(<DashboardLoading />);
    expect(getAllByTestId("skeleton-tile").length).toBe(6);
  });
});

describe("NodesLoading", () => {
  it("renders a shimmer table skeleton", () => {
    const { container, getByTestId } = render(<NodesLoading />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
    expect(getByTestId("skeleton-table")).toBeInTheDocument();
  });

  it("renders the header skeleton area", () => {
    const { container } = render(<NodesLoading />);
    const headerDiv = container.querySelector(".flex.items-center.justify-between");
    expect(headerDiv).toBeTruthy();
  });
});

describe("NodeDetailLoading", () => {
  it("renders stat and text skeletons", () => {
    const { container, getByTestId } = render(<NodeDetailLoading />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
    expect(getByTestId("skeleton-text")).toBeInTheDocument();
  });
});
