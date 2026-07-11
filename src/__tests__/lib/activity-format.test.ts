import { describe, it, expect } from "vitest";
import { formatActivity, formatDetail } from "@/lib/activity-format";

describe("formatActivity", () => {
  it("maps node lifecycle actions", () => {
    expect(formatActivity("node.create")).toEqual({ label: "Registered node", tone: "create" });
    expect(formatActivity("node.update")).toEqual({ label: "Updated node connection", tone: "update" });
    expect(formatActivity("node.delete")).toEqual({ label: "Removed node", tone: "destructive" });
  });

  it("maps proxy actions by method + pretty path", () => {
    expect(formatActivity("proxy.post.sessions/terminate")).toEqual({
      label: "Ran sessions terminate",
      tone: "create",
    });
    expect(formatActivity("proxy.put.network/dns")).toEqual({
      label: "Updated network dns",
      tone: "update",
    });
    expect(formatActivity("proxy.patch.a/b")).toEqual({ label: "Updated a b", tone: "update" });
    expect(formatActivity("proxy.delete.ip-pool/soho")).toEqual({
      label: "Deleted ip pool soho",
      tone: "destructive",
    });
    expect(formatActivity("proxy.get.system/info")).toEqual({
      label: "Called system info",
      tone: "default",
    });
  });

  it("falls back to a readable label for unknown actions", () => {
    expect(formatActivity("something.weird_here")).toEqual({
      label: "something weird here",
      tone: "default",
    });
  });
});

describe("formatDetail", () => {
  it("returns null for empty detail", () => {
    expect(formatDetail(null)).toBeNull();
  });

  it("summarises a status blob (ok / failed)", () => {
    expect(formatDetail(JSON.stringify({ status: 200, ok: true }))).toBe("ok · HTTP 200");
    expect(formatDetail(JSON.stringify({ status: 500, ok: false }))).toBe("failed · HTTP 500");
    expect(formatDetail(JSON.stringify({ status: 204 }))).toBe("ok · HTTP 204");
  });

  it("summarises other JSON objects (first keys)", () => {
    expect(formatDetail(JSON.stringify({ name: "soho", ip_range: "10.0.0.0/24", x: 1, y: 2 }))).toBe(
      "name: soho · ip_range: 10.0.0.0/24 · x: 1",
    );
  });

  it("passes through non-JSON strings, truncating long ones", () => {
    expect(formatDetail("plain note")).toBe("plain note");
    const long = "x".repeat(120);
    expect(formatDetail(long)).toBe(`${"x".repeat(80)}…`);
  });
});
