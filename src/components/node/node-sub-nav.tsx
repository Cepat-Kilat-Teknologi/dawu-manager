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
 * Premium horizontal sub-navigation for per-node category pages.
 * Renders scrollable flat pills grouped by section with a primary underline on
 * the active tab. Sticky under the node header; all 16 node pages inherit it.
 */
export function NodeSubNav({ nodeId }: NodeSubNavProps) {
  const pathname = usePathname();
  const basePath = `/nodes/${nodeId}`;

  return (
    <nav
      className="sticky top-16 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Node navigation"
    >
      <div className="scrollbar-thin flex overflow-x-auto">
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
                    "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.title}
                </Link>
              );
            })}
            <div
              className="mx-1 h-4 w-px shrink-0 bg-border"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </nav>
  );
}
