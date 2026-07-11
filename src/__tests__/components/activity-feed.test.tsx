import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import "@/__tests__/ui-mocks";
import { ActivityFeed } from "@/components/activity/activity-feed";

const NODES = [
  { id: "n1", name: "accel-2" },
  { id: "n2", name: "dawos-dev" },
];

const ITEMS = [
  {
    id: "a1",
    ts: "2026-07-11T10:00:00Z",
    actor: "admin",
    nodeId: "n1",
    nodeName: "accel-2",
    action: "proxy.post.sessions/terminate",
    detail: '{"status":200,"ok":true}',
  },
  {
    id: "a2",
    ts: "2026-07-11T09:00:00Z",
    actor: "operator",
    nodeId: null,
    nodeName: null,
    action: "node.create",
    detail: null,
  },
];

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const w = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return render(ui, { wrapper: w });
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ items: ITEMS }),
  } as Response);
});

afterEach(() => vi.restoreAllMocks());

describe("ActivityFeed", () => {
  it("renders the live feed with items", async () => {
    wrap(<ActivityFeed nodes={NODES} />);
    expect(await screen.findByText(/Ran sessions terminate/)).toBeTruthy();
    expect(screen.getByText("Registered node")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    // "accel-2" appears both in the node-filter option and the item row.
    expect(screen.getAllByText("accel-2").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("ok · HTTP 200")).toBeTruthy(); // detail rendered
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("filters items by search term", async () => {
    wrap(<ActivityFeed nodes={NODES} />);
    await screen.findByText(/Ran sessions terminate/);
    fireEvent.change(screen.getByPlaceholderText("Search action, user, node…"), {
      target: { value: "terminate" },
    });
    expect(screen.getByText(/Ran sessions terminate/)).toBeTruthy();
    expect(screen.queryByText("Registered node")).toBeNull();
  });

  it("changes the node filter", async () => {
    wrap(<ActivityFeed nodes={NODES} />);
    await screen.findByText(/Ran sessions terminate/);
    fireEvent.change(screen.getByLabelText("Filter by node"), {
      target: { value: "n1" },
    });
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) =>
          String(c[0]).includes("nodeId=n1"),
        ),
      ).toBe(true),
    );
  });

  it("refreshes on demand", async () => {
    wrap(<ActivityFeed nodes={NODES} />);
    await screen.findByText(/Ran sessions terminate/);
    const before = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(before),
    );
  });

  it("shows the empty state when there is no activity", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    } as Response);
    wrap(<ActivityFeed nodes={NODES} />);
    expect(await screen.findByText("No activity yet")).toBeTruthy();
  });

  it("shows an error state with retry", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    wrap(<ActivityFeed nodes={NODES} />);
    expect(await screen.findByText("Could not load activity.")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry"));
  });
});
