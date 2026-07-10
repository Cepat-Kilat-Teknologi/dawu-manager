"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { Server } from "lucide-react";
import { Separator } from "@/components/ui/separator";

/**
 * Individual sidebar navigation link with active-state highlighting.
 * Renders an icon, title, and optional badge count.
 * Uses the dedicated sidebar design tokens for proper spatial hierarchy.
 * @param item - Navigation item configuration (title, href, icon, badge)
 * @param pathname - Current URL pathname used to determine active state
 */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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

interface SidebarProps {
  userRole?: string;
}

/**
 * Desktop sidebar navigation panel (hidden on mobile via `md:` breakpoint).
 * Renders the application logo, role-filtered nav sections from `mainNavItems`,
 * and a version footer. Fixed position on the left edge.
 * Uses dedicated sidebar design tokens for distinct visual hierarchy.
 * @param userRole - Current user's role for filtering role-restricted nav items
 */
export function Sidebar({ userRole = "viewer" }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex lg:w-[260px] lg:flex-col lg:fixed lg:inset-y-0 border-r border-sidebar-border bg-sidebar"
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

      {/* Nav sections */}
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
                {visibleItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

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
