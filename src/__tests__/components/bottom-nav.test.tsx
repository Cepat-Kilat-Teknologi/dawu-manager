import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockPathname } = vi.hoisted(() => ({ mockPathname: { value: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
}));

import {
  BottomNav,
  bottomNavItems,
  isBottomNavActive,
} from "@/components/layout/bottom-nav";

describe("isBottomNavActive", () => {
  it("matches root only exactly", () => {
    expect(isBottomNavActive("/", "/")).toBe(true);
    expect(isBottomNavActive("/", "/nodes")).toBe(false);
  });

  it("matches non-root by prefix", () => {
    expect(isBottomNavActive("/nodes", "/nodes/n1")).toBe(true);
    expect(isBottomNavActive("/nodes", "/settings")).toBe(false);
  });
});

describe("BottomNav", () => {
  it("renders all five destinations including Search", () => {
    mockPathname.value = "/";
    render(<BottomNav />);
    for (const item of bottomNavItems) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
    // Search is the center action, not a link.
    expect(screen.getByText("Search").closest("a")).toBeNull();
  });

  it("has no /alerts link", () => {
    mockPathname.value = "/";
    const { container } = render(<BottomNav />);
    expect(container.querySelector('a[href="/alerts"]')).toBeNull();
  });

  it("opens the command palette from the Search action", () => {
    mockPathname.value = "/";
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<BottomNav />);
    fireEvent.click(screen.getByLabelText("Open command palette"));
    const opened = spy.mock.calls
      .map((c) => (c[0] as Event).type)
      .includes("open-command-palette");
    expect(opened).toBe(true);
    spy.mockRestore();
  });

  it("marks Dashboard active on root", () => {
    mockPathname.value = "/";
    render(<BottomNav />);
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Nodes active on a node subpath", () => {
    mockPathname.value = "/nodes/n1";
    render(<BottomNav />);
    expect(screen.getByText("Nodes").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is hidden at md and above (mobile only)", () => {
    mockPathname.value = "/";
    const { container } = render(<BottomNav />);
    expect(container.querySelector("nav")?.className).toContain("md:hidden");
  });
});
