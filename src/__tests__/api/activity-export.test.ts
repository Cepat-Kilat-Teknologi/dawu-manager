import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { auditLog: { findMany: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, escapeCSV } from "@/app/api/activity/export/route";

const adminSession = { user: { id: "u1", name: "admin", role: "admin" } };
const operatorSession = { user: { id: "u2", name: "op", role: "operator" } };

const makeReq = (qs = "") =>
  new Request(`http://localhost:3789/api/activity/export${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
});

describe("escapeCSV", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("wraps strings with commas in quotes", () => {
    expect(escapeCSV("a,b")).toBe('"a,b"');
  });

  it("wraps strings with double-quotes and doubles them", () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps strings with newlines in quotes", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes formula injection with = prefix", () => {
    expect(escapeCSV("=CMD()")).toBe("'=CMD()");
  });

  it("neutralizes formula injection with + prefix", () => {
    expect(escapeCSV("+1234")).toBe("'+1234");
  });

  it("neutralizes formula injection with - prefix", () => {
    expect(escapeCSV("-1+2")).toBe("'-1+2");
  });

  it("neutralizes formula injection with @ prefix", () => {
    expect(escapeCSV("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralizes tab prefix", () => {
    expect(escapeCSV("\tdata")).toBe("'\tdata");
  });

  it("neutralizes CR prefix", () => {
    expect(escapeCSV("\rdata")).toBe("'\rdata");
  });

  it("applies both formula guard and RFC-4180 escaping", () => {
    // = prefix + comma → apostrophe prefix then quoted
    expect(escapeCSV("=1,2")).toBe("\"'=1,2\"");
  });
});

describe("GET /api/activity/export", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuth.mockResolvedValue(operatorSession);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns CSV with header and data rows", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        createdAt: new Date("2026-07-11T08:00:00Z"),
        nodeId: "n1",
        action: "node.create",
        detail: '{"name":"accel-2"}',
        user: { name: "admin" },
        node: { name: "accel-2" },
      },
    ]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("audit-log-");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Timestamp,User,Node,Action,Detail");
    expect(lines[1]).toContain("2026-07-11T08:00:00.000Z");
    expect(lines[1]).toContain("admin");
    expect(lines[1]).toContain("accel-2");
    expect(lines[1]).toContain("node.create");
  });

  it("escapes CSV fields with special characters", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a2",
        createdAt: new Date("2026-07-11T09:00:00Z"),
        nodeId: null,
        action: "proxy.post.sessions/terminate",
        detail: 'value with "quotes", commas',
        user: { name: "admin" },
        node: null,
      },
    ]);
    const csv = await (await GET(makeReq())).text();
    const dataLine = csv.split("\n")[1];
    // Detail field should be escaped
    expect(dataLine).toContain('"value with ""quotes"", commas"');
  });

  it("handles null user and node gracefully", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a3",
        createdAt: new Date("2026-07-11T10:00:00Z"),
        nodeId: null,
        action: "node.delete",
        detail: null,
        user: null,
        node: null,
      },
    ]);
    const csv = await (await GET(makeReq())).text();
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("system");
    // Empty node and detail fields
    expect(dataLine).toBe(
      "2026-07-11T10:00:00.000Z,system,,node.delete,",
    );
  });

  it("applies filters (nodeId, userId, action, from, to)", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await GET(
      makeReq(
        "?nodeId=n1&userId=u2&action=node.create&from=2026-07-01&to=2026-07-10",
      ),
    );
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      nodeId: "n1",
      userId: "u2",
      action: "node.create",
      createdAt: {
        gte: new Date("2026-07-01"),
        lte: new Date("2026-07-10"),
      },
    });
  });

  it("defaults limit to 1000 and clamps max to 10000", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await GET(makeReq());
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 }),
    );

    await GET(makeReq("?limit=50000"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 10_000 }),
    );

    await GET(makeReq("?limit=0"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );

    await GET(makeReq("?limit=abc"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1000 }),
    );
  });

  it("returns 403 when role is undefined (defaults to viewer)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", name: "norole" } });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("filters by from-only date", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await GET(makeReq("?from=2026-07-01"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      gte: new Date("2026-07-01"),
    });
  });

  it("filters by to-only date", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await GET(makeReq("?to=2026-07-10"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      lte: new Date("2026-07-10"),
    });
  });

  it("ignores invalid date strings", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await GET(makeReq("?from=bad&to=worse"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it("returns empty CSV (header only) when no logs", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const csv = await (await GET(makeReq())).text();
    expect(csv).toBe("Timestamp,User,Node,Action,Detail");
  });
});
