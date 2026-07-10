import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "lucide-react";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/",
}));

import { CommandPalette, matchesQuery, normalizeNodes } from "@/components/command-palette";

function renderPalette() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CommandPalette />
    </QueryClientProvider>,
  );
}

function openPalette() {
  act(() => {
    window.dispatchEvent(new Event("open-command-palette"));
  });
}

describe("matchesQuery", () => {
  const item = {
    id: "x",
    title: "Settings",
    href: "/settings",
    group: "Pages" as const,
    icon: Settings,
    keywords: "config preferences",
  };

  it("matches everything on an empty query", () => {
    expect(matchesQuery(item, "")).toBe(true);
  });

  it("matches on title and keywords case-insensitively", () => {
    expect(matchesQuery(item, "SETT")).toBe(true);
    expect(matchesQuery(item, "preferences")).toBe(true);
    expect(matchesQuery(item, "nope")).toBe(false);
  });

  it("handles items without keywords", () => {
    const noKeywords = { ...item, keywords: undefined };
    expect(matchesQuery(noKeywords, "settings")).toBe(true);
    expect(matchesQuery(noKeywords, "config")).toBe(false);
  });
});

describe("normalizeNodes", () => {
  it("handles a bare array", () => {
    expect(normalizeNodes([{ id: "1", name: "a" }])).toHaveLength(1);
  });

  it("handles a wrapped { nodes } object", () => {
    expect(normalizeNodes({ nodes: [{ id: "1", name: "a" }] })).toHaveLength(1);
  });

  it("falls back to an empty array for anything else", () => {
    expect(normalizeNodes(null)).toEqual([]);
    expect(normalizeNodes({ foo: 1 })).toEqual([]);
    expect(normalizeNodes("not-an-object")).toEqual([]);
  });
});

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "n1", name: "bng-1" }],
    });
  });

  it("is closed initially", () => {
    renderPalette();
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("opens on the custom event and shows static pages", () => {
    renderPalette();
    openPalette();
    expect(screen.getByLabelText("Command palette search")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
  });

  it("toggles open with Cmd/Ctrl+K", () => {
    renderPalette();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByLabelText("Command palette search")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("filters items by query", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.change(input, { target: { value: "settings" } });
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows a no-results message; arrows and Enter are no-ops", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.change(input, { target: { value: "zzzznomatch" } });
    expect(screen.getByText("No results found.")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.keyDown(input, { key: "a" });
    expect(screen.getByLabelText("Command palette search")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fetches and lists nodes when open", async () => {
    renderPalette();
    openPalette();
    expect(await screen.findByText("bng-1")).toBeInTheDocument();
    // "Nodes" appears as both a page item and the group heading.
    expect(screen.getAllByText("Nodes").length).toBeGreaterThanOrEqual(2);
  });

  it("navigates with arrow keys and Enter", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // → Nodes (index 1)
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/nodes");
  });

  it("wraps selection with ArrowUp from the top", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.keyDown(input, { key: "ArrowUp" }); // wrap to last
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("selects an item on click", () => {
    renderPalette();
    openPalette();
    fireEvent.click(screen.getByText("Add Node"));
    expect(mockPush).toHaveBeenCalledWith("/nodes/new");
  });

  it("highlights an item on hover", () => {
    renderPalette();
    openPalette();
    const audit = screen.getByText("Audit").closest("button")!;
    fireEvent.mouseEnter(audit);
    expect(audit).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape", () => {
    renderPalette();
    openPalette();
    const input = screen.getByLabelText("Command palette search");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("treats a failed nodes fetch as no nodes", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    renderPalette();
    openPalette();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // Static pages still render; no node rows.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
