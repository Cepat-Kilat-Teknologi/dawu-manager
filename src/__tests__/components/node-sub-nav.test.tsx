import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/config/navigation", () => ({
  nodeNavSections: [
    {
      title: "General",
      items: [
        { title: "Overview", href: "", icon: () => <svg data-testid="icon-overview" /> },
        { title: "Sessions", href: "/sessions", icon: () => <svg data-testid="icon-sessions" /> },
      ],
    },
    {
      title: "Network",
      items: [
        { title: "Firewall", href: "/firewall", icon: () => <svg data-testid="icon-firewall" /> },
      ],
    },
  ],
}));

const { mockPathname } = vi.hoisted(() => ({
  mockPathname: vi.fn(() => "/nodes/n1"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { NodeSubNav } from "@/components/node/node-sub-nav";

describe("NodeSubNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/nodes/n1");
  });

  it("renders all nav items from sections", () => {
    render(<NodeSubNav nodeId="n1" />);

    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Sessions")).toBeTruthy();
    expect(screen.getByText("Firewall")).toBeTruthy();
  });

  it("renders navigation landmark", () => {
    render(<NodeSubNav nodeId="n1" />);

    expect(screen.getByRole("navigation", { name: "Node navigation" })).toBeTruthy();
  });

  it("marks Overview as active when on base path", () => {
    mockPathname.mockReturnValue("/nodes/n1");
    render(<NodeSubNav nodeId="n1" />);

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).toHaveAttribute("aria-current", "page");
  });

  it("marks Sessions as active when on sessions path", () => {
    mockPathname.mockReturnValue("/nodes/n1/sessions");
    render(<NodeSubNav nodeId="n1" />);

    const sessionsLink = screen.getByText("Sessions").closest("a");
    expect(sessionsLink).toHaveAttribute("aria-current", "page");

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).not.toHaveAttribute("aria-current");
  });

  it("generates correct hrefs", () => {
    render(<NodeSubNav nodeId="abc123" />);

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).toHaveAttribute("href", "/nodes/abc123");

    const sessionsLink = screen.getByText("Sessions").closest("a");
    expect(sessionsLink).toHaveAttribute("href", "/nodes/abc123/sessions");
  });

  it("renders section dividers", () => {
    render(<NodeSubNav nodeId="n1" />);

    // Each section gets a divider div
    const dividers = document.querySelectorAll('[aria-hidden="true"]');
    // 3 icons + 2 section dividers = 5 aria-hidden
    expect(dividers.length).toBeGreaterThanOrEqual(2);
  });

  it("renders icons for each item", () => {
    render(<NodeSubNav nodeId="n1" />);

    expect(screen.getByTestId("icon-overview")).toBeTruthy();
    expect(screen.getByTestId("icon-sessions")).toBeTruthy();
    expect(screen.getByTestId("icon-firewall")).toBeTruthy();
  });
});
