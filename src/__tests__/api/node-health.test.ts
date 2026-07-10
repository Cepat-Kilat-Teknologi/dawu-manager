import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockCheckHealth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    node: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockCheckHealth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/dawos-client", () => ({
  checkNodeHealth: (...args: unknown[]) => mockCheckHealth(...args),
}));

import { GET } from "@/app/api/nodes/[nodeId]/health/route";

const adminSession = { user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" } };
const makeParams = (nodeId: string) => ({ params: Promise.resolve({ nodeId }) });

describe("GET /api/nodes/:nodeId/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await GET(new Request("http://x"), makeParams("n1"))).status).toBe(401);
  });

  it("returns 404 when node not found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(null);
    expect((await GET(new Request("http://x"), makeParams("n1"))).status).toBe(404);
  });

  it("returns health data and updates node status to online", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue({ id: "n1", url: "http://192.168.1.10:8470" });
    mockCheckHealth.mockResolvedValue({
      ok: true, status: 200, data: { status: "ok", version: "0.3.2", uptime_seconds: 3600 },
    });
    mockPrisma.node.update.mockResolvedValue({});

    const res = await GET(new Request("http://x"), makeParams("n1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("online");
    expect(json.health).toEqual({ status: "ok", version: "0.3.2", uptime_seconds: 3600 });
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: expect.objectContaining({ status: "online" }),
    });
  });

  it("sets status offline when health check fails", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue({ id: "n1", url: "http://unreachable:8470" });
    mockCheckHealth.mockResolvedValue({ ok: false, status: 0, data: { error: "Unreachable" } });
    mockPrisma.node.update.mockResolvedValue({});

    const json = await (await GET(new Request("http://x"), makeParams("n1"))).json();
    expect(json.status).toBe("offline");
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" }, data: expect.objectContaining({ status: "offline" }),
    });
  });
});
