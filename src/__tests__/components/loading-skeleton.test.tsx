import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Skeleton,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonNodeCard,
  SkeletonTable,
  SkeletonDetail,
} from "@/components/shared/loading-skeleton";

describe("Skeleton", () => {
  it("renders with aria-hidden", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[aria-hidden="true"]');
    expect(el).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="h-8 w-24" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-8");
    expect(el.className).toContain("w-24");
  });

  it("has animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
  });
});

describe("SkeletonCard", () => {
  it("renders 3 skeleton bars", () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBe(3);
  });

  it("applies custom className", () => {
    const { container } = render(<SkeletonCard className="my-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-class");
  });
});

describe("SkeletonStatCard", () => {
  it("renders stat card skeleton structure", () => {
    const { container } = render(<SkeletonStatCard />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // 2 in header row + 1 value + 1 description = 4
    expect(skeletons.length).toBe(4);
  });
});

describe("SkeletonNodeCard", () => {
  it("renders node card skeleton structure", () => {
    const { container } = render(<SkeletonNodeCard />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // name + url + badge + left text + right text = 5
    expect(skeletons.length).toBe(5);
  });
});

describe("SkeletonTable", () => {
  it("renders default 5 rows x 4 cols", () => {
    const { container } = render(<SkeletonTable />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // header (4) + 5 rows * 4 cols = 24
    expect(skeletons.length).toBe(24);
  });

  it("renders custom rows and cols", () => {
    const { container } = render(<SkeletonTable rows={3} cols={2} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // header (2) + 3 rows * 2 cols = 8
    expect(skeletons.length).toBe(8);
  });

  it("applies custom className", () => {
    const { container } = render(<SkeletonTable className="my-table" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-table");
  });
});

describe("SkeletonDetail", () => {
  it("renders detail page skeleton structure", () => {
    const { container } = render(<SkeletonDetail />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    // Header: icon(1) + title(1) + badge(1) + subtitle(1) = 4
    // Stats: 4 SkeletonStatCard × 4 = 16
    // Info card: title(1) + 4 items × 2 = 9
    expect(skeletons.length).toBe(29);
  });

  it("applies custom className", () => {
    const { container } = render(<SkeletonDetail className="my-detail" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-detail");
  });
});
