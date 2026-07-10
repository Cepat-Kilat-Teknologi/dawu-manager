import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    node: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/nodes/n1",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock child components used in layout
vi.mock("@/components/shared/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));
vi.mock("@/components/dashboard/refresh-health-button", () => ({
  RefreshHealthButton: () => <button data-testid="refresh-btn">Refresh</button>,
}));
vi.mock("@/components/dashboard/edit-node-dialog", () => ({
  EditNodeDialog: () => <button data-testid="edit-btn">Edit</button>,
}));
vi.mock("@/components/dashboard/delete-node-button", () => ({
  DeleteNodeButton: () => <button data-testid="delete-btn">Delete</button>,
}));
vi.mock("@/components/node/node-sub-nav", () => ({
  NodeSubNav: ({ nodeId }: { nodeId: string }) => (
    <nav data-testid="node-sub-nav">nav-{nodeId}</nav>
  ),
}));

import NodeLayout from "@/app/(dashboard)/nodes/[nodeId]/layout";

const baseNode = {
  id: "n1",
  name: "bng-jakarta-1",
  url: "http://192.168.1.10:8470",
  apiKey: "enc-key",
  location: "Jakarta DC",
  tags: '["production"]',
  status: "online",
  lastSeen: new Date("2025-06-15T12:00:00Z"),
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-06-15T12:00:00Z"),
};

describe("NodeLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("throws notFound when node does not exist", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(null);

    await expect(
      NodeLayout({
        children: <p>Content</p>,
        params: Promise.resolve({ nodeId: "nope" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders node name and URL", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeLayout({
      children: <p>Page content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("bng-jakarta-1")).toBeTruthy();
    expect(screen.getByText("http://192.168.1.10:8470")).toBeTruthy();
  });

  it("renders children", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeLayout({
      children: <p>My page content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("My page content")).toBeTruthy();
  });

  it("renders sub-navigation", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByTestId("node-sub-nav")).toBeTruthy();
    expect(screen.getByText("nav-n1")).toBeTruthy();
  });

  it("renders action buttons", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByTestId("refresh-btn")).toBeTruthy();
    expect(screen.getByTestId("edit-btn")).toBeTruthy();
    expect(screen.getByTestId("delete-btn")).toBeTruthy();
  });

  it("shows online status when health check succeeds", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    } as Response);

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("online")).toBeTruthy();
  });

  it("shows degraded status when health response is not ok status", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "degraded" }),
    } as Response);

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("degraded")).toBeTruthy();
  });

  it("falls back to stored status when health check fails", async () => {
    const offlineNode = { ...baseNode, status: "offline" };
    mockPrisma.node.findUnique.mockResolvedValue(offlineNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("offline")).toBeTruthy();
  });

  it("has back link to nodes list", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("Back to nodes")).toBeTruthy();
  });

  it("uses stored status when fetch returns non-ok HTTP", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, status: "unknown" });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(screen.getByText("unknown")).toBeTruthy();
  });

  it("fires abort callback when fetch rejects and timer expires", async () => {
    vi.useFakeTimers();
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("connection refused"));

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });

    // fetch rejected → clearTimeout skipped → timer still pending
    // Advance past the 5000ms abort timeout to fire () => controller.abort()
    vi.advanceTimersByTime(5001);

    render(jsx);
    // Falls back to stored status since fetch failed
    expect(screen.getByText("online")).toBeTruthy();

    vi.useRealTimers();
  });

  it("strips trailing slashes from node URL for health check", async () => {
    const trailingNode = { ...baseNode, url: "http://192.168.1.10:8470///" };
    mockPrisma.node.findUnique.mockResolvedValue(trailingNode);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    } as Response);

    const jsx = await NodeLayout({
      children: <p>Content</p>,
      params: Promise.resolve({ nodeId: "n1" }),
    });
    render(jsx);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "http://192.168.1.10:8470/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
