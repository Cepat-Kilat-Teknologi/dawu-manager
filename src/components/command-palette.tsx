"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  Plus,
  Settings,
  FileText,
  Search,
  type LucideIcon,
} from "lucide-react";

/** A selectable command palette entry. */
interface CommandItem {
  id: string;
  title: string;
  href: string;
  group: "Pages" | "Nodes";
  icon: LucideIcon;
  keywords?: string;
}

/** Static navigation destinations always available in the palette. */
const staticItems: CommandItem[] = [
  { id: "p-dashboard", title: "Dashboard", href: "/", group: "Pages", icon: LayoutDashboard, keywords: "home overview" },
  { id: "p-nodes", title: "Nodes", href: "/nodes", group: "Pages", icon: Server, keywords: "bng servers list" },
  { id: "p-new", title: "Add Node", href: "/nodes/new", group: "Pages", icon: Plus, keywords: "create new register" },
  { id: "p-audit", title: "Audit", href: "/audit", group: "Pages", icon: FileText, keywords: "log history" },
  { id: "p-settings", title: "Settings", href: "/settings", group: "Pages", icon: Settings, keywords: "config preferences" },
];

/** Minimal node shape needed for palette entries. */
interface NodeLite {
  id: string;
  name: string;
}

/**
 * Normalize the /api/nodes response into a plain node array.
 * Accepts both a bare array and a `{ nodes: [...] }` wrapper.
 */
export function normalizeNodes(data: unknown): NodeLite[] {
  if (Array.isArray(data)) return data as NodeLite[];
  if (data && typeof data === "object" && Array.isArray((data as { nodes?: unknown }).nodes)) {
    return (data as { nodes: NodeLite[] }).nodes;
  }
  return [];
}

/**
 * Case-insensitive substring match on an item's title and keywords.
 */
export function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.title} ${item.keywords ?? ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * Global command palette (⌘K / Ctrl+K).
 *
 * Opens on the keyboard shortcut or the `open-command-palette` window event.
 * Fuzzy-filters static pages plus live nodes (fetched only while open),
 * supports arrow-key navigation, Enter to go, and Esc to dismiss.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: nodesData } = useQuery({
    queryKey: ["command-palette-nodes"],
    queryFn: async () => {
      const res = await fetch("/api/nodes");
      if (!res.ok) return [];
      return normalizeNodes(await res.json());
    },
    enabled: open,
  });

  // Controlled open/close handler. Resets transient state on close (in an event
  // callback, never in an effect) so the next open starts fresh.
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveIndex(0);
    }
  }, []);

  // Global open triggers: ⌘K / Ctrl+K and the custom event.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent() {
      handleOpenChange(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, [handleOpenChange]);

  const nodeItems = useMemo<CommandItem[]>(
    () =>
      (nodesData ?? []).map((node) => ({
        id: `n-${node.id}`,
        title: node.name,
        href: `/nodes/${node.id}`,
        group: "Nodes" as const,
        icon: Server,
        keywords: "node bng",
      })),
    [nodesData],
  );

  const filtered = useMemo(
    () => [...staticItems, ...nodeItems].filter((item) => matchesQuery(item, query)),
    [nodeItems, query],
  );

  // Clamp the highlighted index during render (no effect needed): typing resets
  // it to 0, and the async node list only ever grows the filtered set.
  const safeIndex = activeIndex < filtered.length ? activeIndex : 0;

  const select = useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return;
      handleOpenChange(false);
      router.push(item.href);
    },
    [router, handleOpenChange],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length ? (i - 1 + filtered.length) % filtered.length : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        select(filtered[safeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleOpenChange(false);
      }
    },
    [safeIndex, filtered, select, handleOpenChange],
  );

  const groups: CommandItem["group"][] = ["Pages", "Nodes"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            aria-label="Command palette search"
            placeholder="Search pages and nodes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          ) : (
            groups.map((group) => {
              const groupItems = filtered.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const index = filtered.indexOf(item);
                    const isActive = index === safeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(item)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
