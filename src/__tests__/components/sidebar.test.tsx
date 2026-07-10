import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";

// Mock navigation config to include a badge item for coverage
vi.mock("@/config/navigation", () => ({
  mainNavItems: [
    {
      title: "Overview",
      items: [
        { title: "Dashboard", href: "/", icon: () => null },
        { title: "Nodes", href: "/nodes", icon: () => null, badge: "New" },
      ],
    },
    {
      title: "Management",
      items: [
        { title: "Users", href: "/users", icon: () => null, roles: ["admin"] },
        { title: "Audit Log", href: "/audit", icon: () => null, roles: ["admin"] },
        { title: "Settings", href: "/settings", icon: () => null, roles: ["admin"] },
      ],
    },
  ],
}));

describe("Sidebar", () => {
  it("renders logo text", () => {
    render(<Sidebar />);
    expect(screen.getByText("dawu")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument();
  });

  it("renders version footer from package.json", () => {
    render(<Sidebar />);
    const footer = screen.getByText(/dawu-manager v\d+\.\d+\.\d+/);
    expect(footer).toBeInTheDocument();
  });

  it("renders Overview section for viewer", () => {
    render(<Sidebar userRole="viewer" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("hides admin-only Management section for viewer", () => {
    render(<Sidebar userRole="viewer" />);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit Log")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("shows Management section for admin", () => {
    render(<Sidebar userRole="admin" />);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("has navigation role and label", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav).toBeInTheDocument();
  });

  it("marks Dashboard as active on / path", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("defaults to viewer role", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("renders badge when nav item has badge", () => {
    render(<Sidebar userRole="viewer" />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
