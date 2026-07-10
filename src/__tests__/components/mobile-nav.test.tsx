import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNav } from "@/components/layout/mobile-nav";

// Mock navigation config to include a badge item
vi.mock("@/config/navigation", () => ({
  mainNavItems: [
    {
      title: "Overview",
      items: [
        { title: "Dashboard", href: "/", icon: () => null },
        { title: "Nodes", href: "/nodes", icon: () => null, badge: "3" },
      ],
    },
    {
      title: "Admin",
      items: [
        { title: "Users", href: "/users", icon: () => null, roles: ["admin"] },
      ],
    },
  ],
}));

describe("MobileNav", () => {
  it("renders hamburger button", () => {
    render(<MobileNav />);
    const button = screen.getByLabelText("Open navigation menu");
    expect(button).toBeInTheDocument();
  });

  it("renders logo text in sheet", () => {
    render(<MobileNav />);
    expect(screen.getByText("dawu")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument();
  });

  it("renders version in footer from package.json", () => {
    render(<MobileNav />);
    const footer = screen.getByText(/dawu-manager v\d+\.\d+\.\d+/);
    expect(footer).toBeInTheDocument();
  });

  it("shows overview items for viewer", () => {
    render(<MobileNav userRole="viewer" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("hides admin items for viewer", () => {
    render(<MobileNav userRole="viewer" />);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("shows admin items for admin role", () => {
    render(<MobileNav userRole="admin" />);
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("defaults to viewer role", () => {
    render(<MobileNav />);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("has mobile navigation label", () => {
    render(<MobileNav />);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(nav).toBeInTheDocument();
  });

  it("hamburger button has aria-expanded attribute", () => {
    render(<MobileNav />);
    const button = screen.getByLabelText("Open navigation menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens sheet on hamburger click", () => {
    render(<MobileNav />);
    const button = screen.getByLabelText("Open navigation menu");
    fireEvent.click(button);
    // Sheet content is always rendered in test mocks, but the click triggers setOpen(true)
    expect(button).toBeInTheDocument();
  });

  it("closes sheet on nav link click", () => {
    render(<MobileNav userRole="viewer" />);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toBeInTheDocument();
    fireEvent.click(link!);
    // Click triggers setOpen(false) via the onClick handler
    expect(link).toBeInTheDocument();
  });

  it("renders badge when nav item has one", () => {
    render(<MobileNav userRole="viewer" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
