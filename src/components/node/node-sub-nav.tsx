"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { nodeNavSections } from "@/config/navigation";

interface NodeSubNavProps {
  /** Base path for the node (e.g. "/nodes/abc123"). */
  nodeId: string;
}

/**
 * Horizontal sub-navigation for per-node category pages.
 * Renders grouped tabs that highlight the active category based on pathname.
 * Uses the data-driven nodeNavSections from navigation config.
 * Scrollable on mobile for narrow viewports.
 */
export function NodeSubNav({ nodeId }: NodeSubNavProps) {
  const pathname = usePathname();
  const basePath = `/nodes/${nodeId}`;

  return (
    <nav
      className="border-b bg-card"
      aria-label="Node navigation"
    >
      <div className="flex overflow-x-auto scrollbar-none">
        {nodeNavSections.map((section) => (
          <div key={section.title} className="flex items-center">
            {section.items.map((item) => {
              const href = `${basePath}${item.href}`;
              const isActive =
                item.href === ""
                  ? pathname === basePath
                  : pathname.startsWith(href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                    "border-b-2 -mb-px",
                    "hover:text-foreground",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.title}
                </Link>
              );
            })}
            <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          </div>
        ))}
      </div>
    </nav>
  );
}
