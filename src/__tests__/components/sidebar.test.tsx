import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar, nodeIdFromPathname } from "@/components/layout/sidebar";

const { mockPathname } = vi.hoisted(() => ({ mockPathname: { value: "/" } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => mockPathname.value,
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock navigation config: main nav (with a badge) + node section nav.
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
  nodeNavSections: [
    {
      title: "General",
      items: [
        { title: "Overview", href: "", icon: () => null },
        { title: "Sessions", href: "/sessions", icon: () => null },
      ],
    },
    {
      title: "Network",
      items: [{ title: "Traffic", href: "/traffic", icon: () => null }],
    },
  ],
}));

/** Render inside a QueryClientProvider (node-context branch uses useQuery). */
function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("nodeIdFromPathname", () => {
  it("extracts the node id from a node path", () => {
    expect(nodeIdFromPathname("/nodes/abc123")).toBe("abc123");
    expect(nodeIdFromPathname("/nodes/abc123/traffic")).toBe("abc123");
  });

  it("returns null for non-node paths", () => {
    expect(nodeIdFromPathname("/")).toBeNull();
    expect(nodeIdFromPathname("/nodes")).toBeNull();
    expect(nodeIdFromPathname("/settings")).toBeNull();
  });

  it("returns null for the new-node route (not a real node)", () => {
    expect(nodeIdFromPathname("/nodes/new")).toBeNull();
  });
});

describe("Sidebar — main navigation", () => {
  beforeEach(() => {
    mockPathname.value = "/";
  });

  it("renders logo text", () => {
    render(<Sidebar />);
    expect(screen.getByText("dawu")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument();
  });

  it("renders version footer from package.json", () => {
    render(<Sidebar />);
    expect(
      screen.getByText(/dawu-manager v\d+\.\d+\.\d+/),
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
  });

  it("marks Dashboard as active on / path", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
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

describe("Sidebar — node context navigation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPathname.value = "/nodes/n1";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "accel-2", status: "online" }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("shows the All Nodes back link", () => {
    renderWithQuery(<Sidebar />);
    const back = screen.getByText("All Nodes").closest("a");
    expect(back).toHaveAttribute("href", "/nodes");
  });

  it("renders the node section groups instead of main nav", () => {
    renderWithQuery(<Sidebar />);
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    // Main-nav-only item should not be present in node context.
    expect(screen.queryByText("Audit Log")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton before the node name resolves", () => {
    const { container } = renderWithQuery(<Sidebar />);
    expect(container.querySelector(".skeleton-shimmer")).toBeInTheDocument();
  });

  it("shows the node name once loaded", async () => {
    renderWithQuery(<Sidebar />);
    expect(await screen.findByText("accel-2")).toBeInTheDocument();
  });

  it("builds section links relative to the node base path", () => {
    mockPathname.value = "/nodes/n1/traffic";
    renderWithQuery(<Sidebar />);
    const traffic = screen.getByText("Traffic").closest("a");
    expect(traffic).toHaveAttribute("href", "/nodes/n1/traffic");
    expect(traffic).toHaveAttribute("aria-current", "page");
  });

  it("marks the Overview section active on the node root path", () => {
    mockPathname.value = "/nodes/n1";
    renderWithQuery(<Sidebar />);
    expect(screen.getByText("Overview").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders a degraded status dot", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "accel-2", status: "degraded" }),
    }) as typeof fetch;
    const { container } = renderWithQuery(<Sidebar />);
    await screen.findByText("accel-2");
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
  });

  it("falls back to a neutral dot for unknown status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "accel-2", status: "weird" }),
    }) as typeof fetch;
    const { container } = renderWithQuery(<Sidebar />);
    await screen.findByText("accel-2");
    expect(container.querySelector(".bg-muted-foreground")).toBeInTheDocument();
  });

  it("surfaces a failed node fetch without crashing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    }) as typeof fetch;
    renderWithQuery(<Sidebar />);
    // Skeleton stays; section groups still render.
    await waitFor(() =>
      expect(screen.getByText("General")).toBeInTheDocument(),
    );
  });
});
