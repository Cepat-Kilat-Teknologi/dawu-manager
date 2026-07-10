import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockPathname } = vi.hoisted(() => ({ mockPathname: { value: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
}));

import { Breadcrumbs, buildCrumbs } from "@/components/layout/breadcrumbs";

describe("buildCrumbs", () => {
  it("returns just Dashboard for root", () => {
    expect(buildCrumbs("/")).toEqual([{ label: "Dashboard", href: "/" }]);
  });

  it("capitalizes and hyphen-splits word segments", () => {
    const crumbs = buildCrumbs("/nodes/new");
    expect(crumbs.map((c) => c.label)).toEqual(["Dashboard", "Nodes", "New"]);
    expect(crumbs[1].href).toBe("/nodes");
    expect(crumbs[2].href).toBe("/nodes/new");
  });

  it("truncates long id-like segments", () => {
    const crumbs = buildCrumbs("/nodes/clx1234567890abcdef");
    expect(crumbs[2].label).toBe("clx12345…");
  });

  it("keeps hyphenated slugs readable (capitalized words)", () => {
    const crumbs = buildCrumbs("/nodes/ip-pool");
    expect(crumbs[2].label).toBe("Ip Pool");
  });

  it("tolerates empty words from repeated hyphens", () => {
    const crumbs = buildCrumbs("/a--b");
    expect(crumbs[1].label).toBe("A  B");
  });
});

describe("Breadcrumbs", () => {
  it("renders only the current crumb at root", () => {
    mockPathname.value = "/";
    render(<Breadcrumbs />);
    const current = screen.getByText("Dashboard");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders ancestor links and a muted current crumb", () => {
    mockPathname.value = "/nodes/new";
    render(<Breadcrumbs />);
    // Dashboard + Nodes are links
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Nodes").closest("a")).toHaveAttribute("href", "/nodes");
    // New is current (span, not link)
    const current = screen.getByText("New");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
  });

  it("has an accessible breadcrumb label", () => {
    mockPathname.value = "/nodes";
    render(<Breadcrumbs />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});
