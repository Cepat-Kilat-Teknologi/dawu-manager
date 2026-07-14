import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockDawosRequest } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    node: { findMany: vi.fn() },
  },
  mockDawosRequest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/dawos-client", () => ({
  dawosRequest: (...args: unknown[]) => mockDawosRequest(...args),
}));

import { GET } from "@/app/api/fleet/overview/route";

const session = {
  user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" },
};

function makeNode(id: string, name: string) {
  return {
    id,
    name,
    url: `http://${name}:8470`,
    apiKey: `enc-key-${id}`,
    status: "online",
  };
}

describe("GET /api/fleet/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty overview when no nodes exist", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([]);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.nodes.total).toBe(0);
    expect(json.sessions.total).toBe(0);
    expect(json.topNodes).toEqual([]);
  });

  it("aggregates metrics from multiple reachable nodes", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      makeNode("n2", "bng-2"),
    ]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 40 }, memory: { percent: 60 }, disk: { percent: 30 } },
          });
        }
        if (path === "sessions/stats") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { active: 150 },
          });
        }
        return Promise.resolve({ ok: false, status: 404, data: {} });
      },
    );

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.nodes.total).toBe(2);
    expect(json.nodes.online).toBe(2);
    expect(json.nodes.offline).toBe(0);
    expect(json.sessions.total).toBe(300); // 150 * 2
    expect(json.topNodes).toHaveLength(2);
    expect(json.topNodes[0].sessions).toBe(150);
    expect(json.topNodes[0].cpu).toBe(40);
    expect(json.topNodes[0].memory).toBe(60);
  });

  it("degrades gracefully when a node is unreachable", async () => {
    mockAuth.mockResolvedValue(session);
    const offlineNode = { ...makeNode("n2", "bng-2"), status: "offline" };
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      offlineNode,
    ]);

    let callCount = 0;
    mockDawosRequest.mockImplementation(
      (url: string, _key: string, path: string) => {
        callCount++;
        // bng-1 is reachable
        if (url.includes("bng-1")) {
          if (path === "system/metrics") {
            return Promise.resolve({
              ok: true,
              status: 200,
              data: { cpu: { percent: 50 }, memory: { percent: 70 }, disk: { percent: 20 } },
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { active: 200 },
          });
        }
        // bng-2 is unreachable (both endpoints fail)
        return Promise.resolve({
          ok: false,
          status: 502,
          data: { error: "Failed to connect" },
        });
      },
    );

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    // Status comes from DB: bng-1 "online", bng-2 "offline"
    expect(json.nodes.online).toBe(1);
    expect(json.nodes.offline).toBe(1);
    expect(json.sessions.total).toBe(200); // only bng-1
    expect(callCount).toBe(4); // 2 calls per node
  });

  it("uses DB status when fan-out fails (not re-determined from metrics)", async () => {
    mockAuth.mockResolvedValue(session);
    // Both nodes are "online" in DB, but bng-2 fan-out fails
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      makeNode("n2", "bng-2"),
    ]);

    mockDawosRequest.mockImplementation(
      (url: string, _key: string, path: string) => {
        if (url.includes("bng-1")) {
          if (path === "system/metrics") {
            return Promise.resolve({
              ok: true, status: 200,
              data: { cpu: { percent: 30 }, memory: { percent: 40 }, disk: { percent: 10 } },
            });
          }
          return Promise.resolve({ ok: true, status: 200, data: { active: 100 } });
        }
        // bng-2: both endpoints return errors — but DB says "online"
        return Promise.resolve({ ok: false, status: 502, data: { error: "timeout" } });
      },
    );

    const res = await GET();
    const json = await res.json();

    // bng-2 stays "online" (from DB) despite fan-out failure
    expect(json.nodes.online).toBe(2);
    expect(json.nodes.offline).toBe(0);
    // bng-2 metrics are 0 because fan-out failed
    const bng2 = json.topNodes.find((n: { name: string }) => n.name === "bng-2");
    expect(bng2.status).toBe("online");
    expect(bng2.sessions).toBe(0);
    expect(bng2.cpu).toBe(0);
  });

  it("handles node that throws an exception", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockRejectedValue(new Error("network failure"));

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.nodes.total).toBe(1);
    // Uses DB status ("online") even when fan-out throws
    expect(json.nodes.online).toBe(1);
    expect(json.nodes.offline).toBe(0);
    expect(json.sessions.total).toBe(0);
    expect(json.topNodes[0].status).toBe("online");
  });

  it("uses DB status for offline node on exception", async () => {
    mockAuth.mockResolvedValue(session);
    const offlineNode = { ...makeNode("n1", "bng-1"), status: "offline" };
    mockPrisma.node.findMany.mockResolvedValue([offlineNode]);

    mockDawosRequest.mockRejectedValue(new Error("network failure"));

    const res = await GET();
    const json = await res.json();

    expect(json.nodes.offline).toBe(1);
    expect(json.nodes.online).toBe(0);
    expect(json.topNodes[0].status).toBe("offline");
  });

  it("handles string active session count", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 10 }, memory: { percent: 20 }, disk: { percent: 5 } },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { active: "42" }, // string (dawos-agent returns strings)
        });
      },
    );

    const res = await GET();
    const json = await res.json();
    expect(json.sessions.total).toBe(42);
  });

  it("sorts top nodes by session count descending, then name ascending", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "alpha"),
      makeNode("n2", "bravo"),
      makeNode("n3", "charlie"),
    ]);

    const sessionCounts: Record<string, number> = {
      alpha: 100,
      bravo: 300,
      charlie: 100,
    };

    mockDawosRequest.mockImplementation(
      (url: string, _key: string, path: string) => {
        const name = Object.keys(sessionCounts).find((n) => url.includes(n))!;
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 10 }, memory: { percent: 20 }, disk: { percent: 5 } },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { active: sessionCounts[name] },
        });
      },
    );

    const res = await GET();
    const json = await res.json();

    expect(json.topNodes[0].name).toBe("bravo"); // 300 sessions
    expect(json.topNodes[1].name).toBe("alpha"); // 100 sessions, alpha < charlie
    expect(json.topNodes[2].name).toBe("charlie"); // 100 sessions
  });

  it("limits top nodes to 5", async () => {
    mockAuth.mockResolvedValue(session);
    const nodes = Array.from({ length: 8 }, (_, i) =>
      makeNode(`n${i}`, `node-${i}`),
    );
    mockPrisma.node.findMany.mockResolvedValue(nodes);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 10 }, memory: { percent: 20 }, disk: { percent: 5 } },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { active: 10 },
        });
      },
    );

    const res = await GET();
    const json = await res.json();
    expect(json.topNodes).toHaveLength(5);
  });

  it("handles partial metrics availability (metrics ok, stats fail)", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 55 }, memory: { percent: 75 }, disk: { percent: 40 } },
          });
        }
        // sessions/stats fails
        return Promise.resolve({
          ok: false,
          status: 502,
          data: { error: "timeout" },
        });
      },
    );

    const res = await GET();
    const json = await res.json();

    // Node is online because DB status is "online" (not re-determined from fan-out)
    expect(json.nodes.online).toBe(1);
    expect(json.sessions.total).toBe(0); // stats failed
    expect(json.topNodes[0].cpu).toBe(55);
  });

  it("handles metrics with missing sub-fields", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: {}, memory: {} }, // missing percent + no disk key
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { active: 5 },
        });
      },
    );

    const res = await GET();
    const json = await res.json();

    expect(json.topNodes[0].cpu).toBe(0);
    expect(json.topNodes[0].memory).toBe(0);
    expect(json.topNodes[0].disk).toBe(0);
    expect(json.topNodes[0].sessions).toBe(5);
  });

  it("falls back to 0 sessions when active field is missing", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 10 }, memory: { percent: 20 }, disk: { percent: 5 } },
          });
        }
        // sessions/stats returns ok but with no 'active' field
        return Promise.resolve({
          ok: true,
          status: 200,
          data: {},
        });
      },
    );

    const res = await GET();
    const json = await res.json();
    expect(json.sessions.total).toBe(0);
    expect(json.topNodes[0].sessions).toBe(0);
    expect(json.nodes.online).toBe(1);
  });

  it("respects degraded and unknown DB statuses in aggregate counts", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findMany.mockResolvedValue([
      { ...makeNode("n1", "bng-1"), status: "degraded" },
      { ...makeNode("n2", "bng-2"), status: "unknown" },
      makeNode("n3", "bng-3"), // "online"
    ]);

    mockDawosRequest.mockImplementation(
      (_url: string, _key: string, path: string) => {
        if (path === "system/metrics") {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { cpu: { percent: 10 }, memory: { percent: 20 }, disk: { percent: 5 } },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { active: 50 },
        });
      },
    );

    const res = await GET();
    const json = await res.json();

    expect(json.nodes.total).toBe(3);
    expect(json.nodes.online).toBe(1);
    expect(json.nodes.degraded).toBe(1);
    expect(json.nodes.unknown).toBe(1);
    expect(json.nodes.offline).toBe(0);
  });
});
