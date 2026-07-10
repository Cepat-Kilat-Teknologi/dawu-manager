import { describe, it, expect } from "vitest";
import { cn, formatDate, formatUptime, formatValue } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end");
  });

  it("merges tailwind conflicts (last wins)", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    const date = new Date("2026-07-09T15:30:00Z");
    const result = formatDate(date);
    expect(result).toContain("2026");
    expect(result).toContain("Jul");
  });

  it("formats a date string", () => {
    const result = formatDate("2026-01-15T10:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("handles ISO string", () => {
    // Use a mid-month date to avoid timezone boundary issues
    const result = formatDate("2025-06-15T12:00:00.000Z");
    expect(result).toContain("2025");
    expect(result).toContain("Jun");
  });
});

describe("formatUptime", () => {
  it("formats seconds into days, hours, minutes", () => {
    // 2 days, 5 hours, 30 minutes = 2*86400 + 5*3600 + 30*60 = 192600
    expect(formatUptime(192600)).toBe("2d 5h 30m");
  });

  it("handles zero seconds", () => {
    expect(formatUptime(0)).toBe("0m");
  });

  it("handles minutes only", () => {
    expect(formatUptime(300)).toBe("5m");
  });

  it("handles hours and minutes", () => {
    expect(formatUptime(3660)).toBe("1h 1m");
  });

  it("handles days only", () => {
    expect(formatUptime(86400)).toBe("1d 0m");
  });

  it("handles large values", () => {
    // 365 days
    expect(formatUptime(365 * 86400)).toBe("365d 0m");
  });

  it("handles fractional seconds (floor)", () => {
    expect(formatUptime(61.9)).toBe("1m");
  });
});

describe("formatValue", () => {
  it("returns dash for null", () => {
    expect(formatValue(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatValue(undefined)).toBe("—");
  });

  it("returns 'true' for boolean true", () => {
    expect(formatValue(true)).toBe("true");
  });

  it("returns 'false' for boolean false", () => {
    expect(formatValue(false)).toBe("false");
  });

  it("formats numbers with locale", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue(0)).toBe("0");
  });

  it("returns strings as-is", () => {
    expect(formatValue("hello")).toBe("hello");
    expect(formatValue("")).toBe("");
  });

  it("returns dash for empty array", () => {
    expect(formatValue([])).toBe("—");
  });

  it("joins primitive arrays with commas", () => {
    expect(formatValue([1, 2, 3])).toBe("1, 2, 3");
    expect(formatValue(["a", "b"])).toBe("a, b");
  });

  it("handles arrays with null elements as primitives", () => {
    expect(formatValue([null, "x"])).toBe(", x");
  });

  it("JSON-stringifies arrays of objects", () => {
    const val = [{ a: 1 }, { b: 2 }];
    expect(formatValue(val)).toBe(JSON.stringify(val));
  });

  it("returns dash for empty object", () => {
    expect(formatValue({})).toBe("—");
  });

  it("formats flat objects as key: value pairs", () => {
    expect(formatValue({ count: 2, name: "cpu" })).toBe("count: 2, name: cpu");
  });

  it("JSON-stringifies nested objects", () => {
    const val = { cpu: { count: 2, percent: 0 } };
    expect(formatValue(val)).toBe(JSON.stringify(val));
  });

  it("handles mixed flat objects with null values", () => {
    expect(formatValue({ a: 1, b: null })).toBe("a: 1, b: null");
  });

  it("falls back to String() for other types", () => {
    expect(formatValue(Symbol.for("test"))).toBe("Symbol(test)");
  });
});
