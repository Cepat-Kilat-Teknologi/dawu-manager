"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  Search,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** A single bottom-nav destination or action. */
interface BottomNavItem {
  title: string;
  icon: LucideIcon;
  /** Destination href (link item). Omitted for action items. */
  href?: string;
  /** Action items dispatch the command-palette event instead of navigating. */
  action?: "command-palette";
}

/** Fixed 5-item mobile bottom navigation set (center slot opens search). */
export const bottomNavItems: BottomNavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Nodes", href: "/nodes", icon: Server },
  { title: "Search", icon: Search, action: "command-palette" },
  { title: "Audit", href: "/audit", icon: FileText },
  { title: "Settings", href: "/settings", icon: Settings },
];

/**
 * Determine whether a bottom-nav link is active for the current pathname.
 * "/" is only active on an exact match; others match on prefix.
 */
export function isBottomNavActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const itemClass =
  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors";

/**
 * Mobile-only fixed bottom navigation bar (hidden at `lg` and above).
 * Four link destinations plus a center Search action that opens the command
 * palette. Blurred translucent background with iOS safe-area bottom padding.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/80 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {bottomNavItems.map((item) => {
        const Icon = item.icon;

        if (item.action === "command-palette") {
          return (
            <button
              key={item.title}
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("open-command-palette"))
              }
              aria-label="Open command palette"
              className={cn(itemClass, "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.title}</span>
            </button>
          );
        }

        const active = isBottomNavActive(item.href!, pathname);
        return (
          <Link
            key={item.href}
            href={item.href!}
            className={cn(
              itemClass,
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
