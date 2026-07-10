import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SkeletonTile,
  SkeletonTable,
  SkeletonChart,
  SkeletonText,
} from "@/components/shared/skeleton-blocks";

describe("skeleton-blocks", () => {
  it("SkeletonTile renders a shimmer tile", () => {
    render(<SkeletonTile />);
    const tile = screen.getByTestId("skeleton-tile");
    expect(tile.className).toContain("skeleton-shimmer");
    expect(tile.className).toContain("h-24");
  });

  it("SkeletonTile merges custom className", () => {
    render(<SkeletonTile className="custom-tile" />);
    expect(screen.getByTestId("skeleton-tile").className).toContain("custom-tile");
  });

  it("SkeletonTable renders default 10 rows plus a header", () => {
    const { container } = render(<SkeletonTable />);
    const shimmers = container.querySelectorAll(".skeleton-shimmer");
    expect(shimmers.length).toBe(11);
  });

  it("SkeletonTable respects the rows prop", () => {
    const { container } = render(<SkeletonTable rows={3} />);
    const shimmers = container.querySelectorAll(".skeleton-shimmer");
    expect(shimmers.length).toBe(4);
  });

  it("SkeletonChart renders an aspect-video shimmer", () => {
    render(<SkeletonChart />);
    const chart = screen.getByTestId("skeleton-chart");
    expect(chart.className).toContain("aspect-video");
  });

  it("SkeletonText renders default 3 lines with a shortened last line", () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll(".skeleton-shimmer");
    expect(lines.length).toBe(3);
    expect(lines[lines.length - 1].className).toContain("w-2/3");
    expect(lines[0].className).toContain("w-full");
  });

  it("SkeletonText respects the lines prop", () => {
    const { container } = render(<SkeletonText lines={5} />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBe(5);
  });
});
