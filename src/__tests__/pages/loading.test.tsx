import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@/__tests__/ui-mocks";

import DashboardLoading from "@/app/(dashboard)/loading";
import NodesLoading from "@/app/(dashboard)/nodes/loading";
import NodeDetailLoading from "@/app/(dashboard)/nodes/[nodeId]/loading";

describe("DashboardLoading", () => {
  it("renders skeleton stat cards and node cards", () => {
    const { container } = render(<DashboardLoading />);
    // 4 stat card skeletons + 3 node card skeletons = 7 skeleton groups
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders animate-pulse elements", () => {
    const { container } = render(<DashboardLoading />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });
});

describe("NodesLoading", () => {
  it("renders skeleton node cards", () => {
    const { container } = render(<NodesLoading />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("renders the header skeleton area", () => {
    const { container } = render(<NodesLoading />);
    // Two header placeholders + button placeholder
    const headerDiv = container.querySelector(".flex.items-center.justify-between");
    expect(headerDiv).toBeTruthy();
  });
});

describe("NodeDetailLoading", () => {
  it("renders SkeletonDetail", () => {
    const { container } = render(<NodeDetailLoading />);
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
