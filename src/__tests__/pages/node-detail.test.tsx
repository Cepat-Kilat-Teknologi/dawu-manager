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

import NodeDetailPage from "@/app/(dashboard)/nodes/[nodeId]/page";

const baseNode = {
  id: "n1",
  name: "bng-jakarta-1",
  url: "http://192.168.1.10:8470",
  apiKey: "enc-key",
  location: "Jakarta DC",
  tags: '["production","jakarta"]',
  status: "online",
  lastSeen: new Date("2025-06-15T12:00:00Z"),
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-06-15T12:00:00Z"),
};

describe("NodeDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("throws notFound when node does not exist", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(null);

    await expect(
      NodeDetailPage({ params: Promise.resolve({ nodeId: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders location", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("Jakarta DC")).toBeTruthy();
  });

  it("renders parsed tags", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("unreachable"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("production, jakarta")).toBeTruthy();
  });

  it("renders health data when fetch succeeds", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          version: "0.3.2",
          uptime_seconds: 86400,
          accel_version: "1.12",
        }),
    } as Response);

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("0.3.2")).toBeTruthy();
    expect(screen.getByText(/accel-ppp: 1.12/)).toBeTruthy();
    expect(screen.getByText("1d 0m")).toBeTruthy();
  });

  it("shows Unknown version when health fails", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("Unknown")).toBeTruthy();
  });

  it("shows — for uptime when health fails", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows Not set when location is null", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, location: null });
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("shows None when tags is null", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, tags: null });
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("None")).toBeTruthy();
  });

  it("shows None when tags is invalid JSON", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, tags: "not-json" });
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("None")).toBeTruthy();
  });

  it("shows None when tags is JSON but not an array", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, tags: '{"key":"val"}' });
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("None")).toBeTruthy();
  });

  it("shows Never when lastSeen is null", async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ ...baseNode, lastSeen: null });
    vi.mocked(global.fetch).mockRejectedValue(new Error("timeout"));

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    const neverElements = screen.getAllByText("Never");
    expect(neverElements.length).toBeGreaterThanOrEqual(1);
  });

  it("handles non-ok health response", async () => {
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal error" }),
    } as Response);

    const jsx = await NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    render(jsx);

    expect(screen.getByText("Unknown")).toBeTruthy();
  });

  it("handles timeout when health fetch hangs", async () => {
    vi.useFakeTimers();
    mockPrisma.node.findUnique.mockResolvedValue(baseNode);
    global.fetch = vi.fn().mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const promise = NodeDetailPage({ params: Promise.resolve({ nodeId: "n1" }) });
    await vi.advanceTimersByTimeAsync(6000);

    const jsx = await promise;
    render(jsx);
    expect(screen.getByText("Unknown")).toBeTruthy();
    vi.useRealTimers();
  });
});
