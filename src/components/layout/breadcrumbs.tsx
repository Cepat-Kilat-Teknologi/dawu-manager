"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** A single resolved breadcrumb entry. */
interface Crumb {
  label: string;
  href: string;
}

/**
 * Convert a URL segment into a human-readable label.
 * Long/ID-like segments (e.g. node ids) are truncated; word segments are capitalized.
 */
function formatSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  // ID-like: long token with no spaces/hyphens → truncate.
  if (decoded.length > 12 && !decoded.includes("-")) {
    return `${decoded.slice(0, 8)}…`;
  }
  return decoded
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Build the breadcrumb trail from the current pathname.
 * Always starts with a "Dashboard" root pointing at "/".
 */
export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/" }];

  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    crumbs.push({ label: formatSegment(segment), href: acc });
  }
  return crumbs;
}

/**
 * Breadcrumb trail derived from the current pathname.
 * Ancestor crumbs are links; the current (last) crumb is muted, non-interactive.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  className="truncate font-medium text-muted-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
