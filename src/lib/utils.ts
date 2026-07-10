import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge and deduplicate Tailwind CSS class names using clsx and tailwind-merge.
 * @param inputs - Class values (strings, arrays, objects) to merge
 * @returns Merged class string with Tailwind conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a Date to a readable locale string. */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format seconds into a human-readable uptime string (e.g. "2d 5h 30m"). */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);

  return parts.join(" ");
}

/**
 * Format an unknown value for display in key-value lists.
 * Handles primitives, arrays, and nested objects gracefully
 * instead of rendering "[object Object]".
 */
export function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    // Array of primitives → join with comma; otherwise JSON
    if (val.length === 0) return "—";
    if (val.every((v) => typeof v !== "object" || v === null)) {
      return val.join(", ");
    }
    return JSON.stringify(val);
  }
  if (typeof val === "object") {
    // Flatten simple objects to "key=value" pairs
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return "—";
    if (entries.every(([, v]) => typeof v !== "object" || v === null)) {
      return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
    }
    return JSON.stringify(val);
  }
  return String(val);
}
