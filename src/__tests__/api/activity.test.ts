import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { auditLog: { findMany: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/activity/route";

const session = { user: { id: "u1", name: "admin", role: "admin" } };

const makeReq = (qs = "") => new Request(`http://localhost:3789/api/activity${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
});

describe("GET /api/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", name: "op", role: "operator" } });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when role is undefined (defaults to viewer)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", name: "norole" } });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns mapped activity items", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        createdAt: new Date("2026-07-11T00:00:00Z"),
        actor: undefined,
        nodeId: "n1",
        action: "proxy.post.sessions/terminate",
        detail: '{"status":200,"ok":true}',
        user: { name: "bob" },
        node: { name: "accel-2" },
      },
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      id: "a1",
      actor: "bob",
      nodeId: "n1",
      nodeName: "accel-2",
      action: "proxy.post.sessions/terminate",
    });
  });

  it("falls back to 'system' actor and null node name", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a2",
        createdAt: new Date(),
        nodeId: null,
        action: "node.delete",
        detail: null,
        user: null,
        node: null,
      },
    ]);
    const body = await (await GET(makeReq())).json();
    expect(body.items[0].actor).toBe("system");
    expect(body.items[0].nodeName).toBeNull();
  });

  it("filters by nodeId and defaults the limit to 100", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?nodeId=n9"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nodeId: "n9" }, take: 100 }),
    );
  });

  it("clamps the limit (max 500, min 1) and handles non-numeric", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?limit=99999"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    await GET(makeReq("?limit=0"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    await GET(makeReq("?limit=abc"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("filters by userId", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?userId=u5"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u5" } }),
    );
  });

  it("filters by action", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?action=node.create"));
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { action: "node.create" } }),
    );
  });

  it("filters by date range (from only)", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?from=2026-07-01T00:00:00Z"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      gte: new Date("2026-07-01T00:00:00Z"),
    });
  });

  it("filters by date range (to only)", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?to=2026-07-10T23:59:59Z"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      lte: new Date("2026-07-10T23:59:59Z"),
    });
  });

  it("filters by date range (both from and to)", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?from=2026-07-01&to=2026-07-10"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      gte: new Date("2026-07-01"),
      lte: new Date("2026-07-10"),
    });
  });

  it("ignores invalid date strings", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?from=not-a-date&to=also-bad"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it("combines multiple filters", async () => {
    mockAuth.mockResolvedValue(session);
    await GET(makeReq("?nodeId=n1&userId=u2&action=node.create"));
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      nodeId: "n1",
      userId: "u2",
      action: "node.create",
    });
  });
});
