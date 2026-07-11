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

const USERS = [
  { id: "u1", name: "admin" },
  { id: "u2", name: "operator" },
];

const ACTIONS = ["node.create", "proxy.post.sessions/terminate"];

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

// "ok · HTTP 200" only appears in the feed list items (from formatDetail),
// never in the filter dropdowns, so it reliably signals that fetch completed.
const DATA_LOADED = "ok · HTTP 200";

describe("ActivityFeed", () => {
  it("renders the live feed with items", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    // Wait for feed data to load (detail text is exclusive to list items)
    await screen.findByText(DATA_LOADED);
    expect(screen.getByText("Live")).toBeTruthy();
    // Filter dropdowns are present
    expect(screen.getByLabelText("Filter by node")).toBeTruthy();
    expect(screen.getByLabelText("Filter by user")).toBeTruthy();
    expect(screen.getByLabelText("Filter by action")).toBeTruthy();
    expect(screen.getByLabelText("From date")).toBeTruthy();
    expect(screen.getByLabelText("To date")).toBeTruthy();
    expect(screen.getByText("Export CSV")).toBeTruthy();
    // Feed items include both action labels
    expect(screen.getAllByText(/Ran sessions terminate/).length).toBeGreaterThanOrEqual(1);
  });

  it("filters items by search term", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    fireEvent.change(screen.getByPlaceholderText("Search action, user, node…"), {
      target: { value: "terminate" },
    });
    // After filtering, "Ran sessions terminate" stays in action dropdown + filtered list
    expect(screen.getAllByText(/Ran sessions terminate/).length).toBeGreaterThanOrEqual(1);
    // "Registered node" is filtered out of the list but stays in the action dropdown
    const registered = screen.queryAllByText("Registered node");
    // Only the dropdown option should remain (1), not a list item (0 in feed)
    expect(registered.length).toBe(1);
  });

  it("changes the node filter", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
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

  it("changes the user filter", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    fireEvent.change(screen.getByLabelText("Filter by user"), {
      target: { value: "u1" },
    });
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) =>
          String(c[0]).includes("userId=u1"),
        ),
      ).toBe(true),
    );
  });

  it("changes the action filter", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    fireEvent.change(screen.getByLabelText("Filter by action"), {
      target: { value: "node.create" },
    });
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) =>
          String(c[0]).includes("action=node.create"),
        ),
      ).toBe(true),
    );
  });

  it("changes the date range filters", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-07-01" },
    });
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) =>
          String(c[0]).includes("from=2026-07-01"),
        ),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-07-10" },
    });
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) =>
          String(c[0]).includes("to=2026-07-10"),
        ),
      ).toBe(true),
    );
  });

  it("triggers CSV export with current filters", async () => {
    // Mock window.location to capture the href assignment
    const originalLocation = window.location;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: hrefSetter,
      get: () => "",
      configurable: true,
    });

    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);

    // Set a filter first
    fireEvent.change(screen.getByLabelText("Filter by node"), {
      target: { value: "n1" },
    });

    fireEvent.click(screen.getByText("Export CSV"));
    expect(hrefSetter).toHaveBeenCalledWith(
      expect.stringContaining("/api/activity/export"),
    );
    expect(hrefSetter).toHaveBeenCalledWith(
      expect.stringContaining("nodeId=n1"),
    );

    // Restore
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("exports CSV without filters when none are set", async () => {
    const originalLocation = window.location;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: hrefSetter,
      get: () => "",
      configurable: true,
    });

    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    fireEvent.click(screen.getByText("Export CSV"));
    expect(hrefSetter).toHaveBeenCalledWith("/api/activity/export");

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("refreshes on demand", async () => {
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    await screen.findByText(DATA_LOADED);
    // Ensure Refresh button is enabled (isFetching=false after data loaded)
    const btn = await waitFor(() => {
      const el = screen.getByText("Refresh");
      expect(el).not.toBeDisabled();
      return el;
    });
    const before = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(btn);
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
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    expect(await screen.findByText("No activity yet")).toBeTruthy();
  });

  it("shows an error state with retry", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    wrap(<ActivityFeed nodes={NODES} users={USERS} actions={ACTIONS} />);
    expect(await screen.findByText("Could not load activity.")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry"));
  });
});
