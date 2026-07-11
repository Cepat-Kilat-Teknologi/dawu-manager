"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import {
  mainNavItems,
  nodeNavSections,
  type NavItem,
} from "@/config/navigation";
import { ArrowLeft, Server } from "lucide-react";
import { Separator } from "@/components/ui/separator";

/**
 * Individual sidebar navigation link with active-state highlighting.
 * Renders an icon, title, and optional badge count.
 * Uses the dedicated sidebar design tokens for proper spatial hierarchy.
 * @param item - Navigation item configuration (title, href, icon, badge)
 * @param isActive - Whether this link matches the current route
 */
function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border-l-2 border-sidebar-primary -ml-[2px]"
          : "text-sidebar-foreground/70",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-sidebar-primary")} aria-hidden="true" />
      <span>{item.title}</span>
      {item.badge && (
        <span className="ml-auto text-xs bg-sidebar-primary/10 text-sidebar-primary px-2 py-0.5 rounded-full font-semibold">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/** Match /nodes/<id>/... but not /nodes/new — returns the node id or null. */
export function nodeIdFromPathname(pathname: string): string | null {
  const match = /^\/nodes\/([^/]+)/.exec(pathname);
  if (!match || match[1] === "new") return null;
  return match[1];
}

/** Status dot color per node status. */
const STATUS_DOT: Record<string, string> = {
  online: "bg-success animate-led-pulse",
  degraded: "bg-warning",
  offline: "bg-destructive",
};

/**
 * Contextual sidebar content shown while inside a node's pages.
 * Replaces the main navigation with the node's section navigation
 * (Portainer-style) so sections never need horizontal scrolling.
 */
function NodeContextNav({ nodeId, pathname }: { nodeId: string; pathname: string }) {
  const basePath = `/nodes/${nodeId}`;

  const { data: node } = useQuery<{ name?: string; status?: string }>({
    queryKey: ["node", nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/nodes/${nodeId}`);
      if (!res.ok) throw new Error("Failed to load node");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6" aria-label="Node navigation">
      <Link
        href="/nodes"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All Nodes
      </Link>

      {/* Node identity */}
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              STATUS_DOT[node?.status ?? ""] ?? "bg-muted-foreground",
            )}
            aria-hidden="true"
          />
          {node?.name ? (
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              {node.name}
            </span>
          ) : (
            <span className="skeleton-shimmer h-4 w-24" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Section groups */}
      {nodeNavSections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
            {section.title}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const href = `${basePath}${item.href}`;
              const isActive =
                item.href === ""
                  ? pathname === basePath
                  : pathname.startsWith(href);
              return (
                <NavLink
                  key={item.href}
                  item={{ ...item, href }}
                  isActive={isActive}
                />
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

interface SidebarProps {
  userRole?: string;
}

/**
 * Desktop sidebar navigation panel (hidden below lg via breakpoint classes).
 * Shows the main app navigation by default; while inside a node's pages it
 * swaps to that node's section navigation (back link, node identity, and
 * grouped section links) so node sections read vertically instead of a
 * horizontally scrolling tab bar.
 * @param userRole - Current user's role for filtering role-restricted nav items
 */
export function Sidebar({ userRole = "viewer" }: SidebarProps) {
  const pathname = usePathname();
  const nodeId = nodeIdFromPathname(pathname);

  return (
    <aside
      className="hidden lg:flex lg:w-[260px] lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 border-r border-sidebar-border bg-sidebar"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Server className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">dawu</span>
          <span className="text-[10px] text-sidebar-foreground/50 font-medium ml-0.5">manager</span>
        </div>
      </div>

      {/* Nav — node context swaps in the node's section navigation */}
      {nodeId ? (
        <NodeContextNav nodeId={nodeId} pathname={pathname} />
      ) : (
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {mainNavItems.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || item.roles.includes(userRole),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <p className="px-3 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <NavLink key={item.href} item={item} isActive={isActive} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      )}

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="p-4">
        <p className="text-[11px] text-sidebar-foreground/40 text-center">
          {APP_NAME} v{APP_VERSION}
        </p>
      </div>
    </aside>
  );
}
