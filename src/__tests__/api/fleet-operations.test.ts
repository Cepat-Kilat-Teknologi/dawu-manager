import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockHasRole, mockPrisma, mockDawosRequest, mockCheckNodeHealth } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockHasRole: vi.fn(),
    mockPrisma: {
      node: { findMany: vi.fn(), update: vi.fn() },
    },
    mockDawosRequest: vi.fn(),
    mockCheckNodeHealth: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/auth-guard", () => ({
  hasRole: (...args: unknown[]) => mockHasRole(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/dawos-client", () => ({
  dawosRequest: (...args: unknown[]) => mockDawosRequest(...args),
  checkNodeHealth: (...args: unknown[]) => mockCheckNodeHealth(...args),
}));

import { POST } from "@/app/api/fleet/operations/route";

const adminSession = {
  user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" },
};

const operatorSession = {
  user: { id: "u2", name: "Op", email: "op@t.com", role: "operator" },
};

function makeNode(id: string, name: string) {
  return {
    id,
    name,
    url: `http://${name}:8470`,
    apiKey: `enc-key-${id}`,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/fleet/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest() {
  return new Request("http://localhost/api/fleet/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{{{",
  });
}

describe("POST /api/fleet/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.node.update.mockResolvedValue({});
  });

  // --- Auth & RBAC ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks operator role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u3", name: "V", email: "v@t.com", role: "viewer" },
    });
    mockHasRole.mockResolvedValue(false);
    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden");
  });

  it("allows admin users", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockCheckNodeHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "ok" },
    });
    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    expect(res.status).toBe(200);
  });

  it("allows operator users", async () => {
    mockAuth.mockResolvedValue(operatorSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockCheckNodeHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "ok" },
    });
    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    expect(res.status).toBe(200);
  });

  // --- Validation ---

  it("returns 400 for invalid JSON body", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(makeInvalidJsonRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 422 when nodeIds is empty", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(makeRequest({ nodeIds: [], op: "health" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when op is invalid", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(
      makeRequest({ nodeIds: ["n1"], op: "invalid-op" }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when nodeIds is missing", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(makeRequest({ op: "health" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when bulk-terminate has no usernames", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(
      makeRequest({ nodeIds: ["n1"], op: "bulk-terminate" }),
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("usernames required for bulk-terminate");
  });

  it("returns 422 when bulk-terminate has empty usernames array", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    const res = await POST(
      makeRequest({
        nodeIds: ["n1"],
        op: "bulk-terminate",
        params: { usernames: [] },
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when no matching nodes found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([]);
    const res = await POST(
      makeRequest({ nodeIds: ["nonexistent"], op: "health" }),
    );
    expect(res.status).toBe(404);
  });

  // --- Health operation ---

  it("executes health check across multiple nodes", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      makeNode("n2", "bng-2"),
    ]);
    mockCheckNodeHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "ok" },
    });

    const res = await POST(
      makeRequest({ nodeIds: ["n1", "n2"], op: "health" }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(2);
    expect(json.results[0].ok).toBe(true);
    expect(json.results[0].message).toBe("Healthy");
    expect(json.results[1].ok).toBe(true);
    expect(mockPrisma.node.update).toHaveBeenCalledTimes(2);
  });

  it("marks unhealthy nodes as offline in health check", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockCheckNodeHealth.mockResolvedValue({
      ok: false,
      status: 0,
      data: { error: "Unreachable" },
    });

    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    const json = await res.json();

    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].message).toBe("Unreachable");
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "offline", lastSeen: undefined },
    });
  });

  it("updates lastSeen when health check succeeds", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockCheckNodeHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "ok" },
    });

    await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));

    const updateCall = mockPrisma.node.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("online");
    expect(updateCall.data.lastSeen).toBeInstanceOf(Date);
  });

  // --- Restart operation ---

  it("executes restart on selected nodes", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockDawosRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "restarted" },
    });

    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "restart" }));
    const json = await res.json();

    expect(json.results[0].ok).toBe(true);
    expect(json.results[0].message).toBe("Service restarted");
    expect(mockDawosRequest).toHaveBeenCalledWith(
      "http://bng-1:8470",
      "enc-key-n1",
      "service/action",
      { method: "POST", body: { action: "restart" }, timeout: 15_000 },
    );
  });

  it("reports restart failure per node", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockDawosRequest.mockResolvedValue({
      ok: false,
      status: 500,
      data: { error: "internal" },
    });

    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "restart" }));
    const json = await res.json();

    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].message).toBe("Restart failed");
  });

  // --- Bulk terminate ---

  it("executes bulk terminate with correct body shape", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockDawosRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: { terminated: 2 },
    });

    const res = await POST(
      makeRequest({
        nodeIds: ["n1"],
        op: "bulk-terminate",
        params: { usernames: ["alice", "bob"] },
      }),
    );
    const json = await res.json();

    expect(json.results[0].ok).toBe(true);
    expect(json.results[0].message).toBe("Terminated 2 session(s)");
    expect(mockDawosRequest).toHaveBeenCalledWith(
      "http://bng-1:8470",
      "enc-key-n1",
      "bulk/terminate",
      { method: "POST", body: { usernames: ["alice", "bob"] }, timeout: 15_000 },
    );
  });

  it("reports bulk terminate failure", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockDawosRequest.mockResolvedValue({
      ok: false,
      status: 502,
      data: { error: "timeout" },
    });

    const res = await POST(
      makeRequest({
        nodeIds: ["n1"],
        op: "bulk-terminate",
        params: { usernames: ["alice"] },
      }),
    );
    const json = await res.json();

    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].message).toBe("Terminate failed");
  });

  // --- Partial failure / exception handling ---

  it("handles partial failure across nodes", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      makeNode("n2", "bng-2"),
    ]);

    mockCheckNodeHealth.mockImplementation((url: string) => {
      if (url.includes("bng-1")) {
        return Promise.resolve({ ok: true, status: 200, data: {} });
      }
      return Promise.resolve({ ok: false, status: 0, data: {} });
    });

    const res = await POST(
      makeRequest({ nodeIds: ["n1", "n2"], op: "health" }),
    );
    const json = await res.json();

    expect(json.results).toHaveLength(2);
    const bng1 = json.results.find(
      (r: { nodeName: string }) => r.nodeName === "bng-1",
    );
    const bng2 = json.results.find(
      (r: { nodeName: string }) => r.nodeName === "bng-2",
    );
    expect(bng1.ok).toBe(true);
    expect(bng2.ok).toBe(false);
  });

  it("catches exceptions from individual nodes without failing batch", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode("n1", "bng-1"),
      makeNode("n2", "bng-2"),
    ]);

    mockDawosRequest.mockImplementation(
      (url: string) => {
        if (url.includes("bng-1")) {
          return Promise.resolve({ ok: true, status: 200, data: {} });
        }
        return Promise.reject(new Error("network error"));
      },
    );

    const res = await POST(
      makeRequest({ nodeIds: ["n1", "n2"], op: "restart" }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(2);

    const bng1 = json.results.find(
      (r: { nodeName: string }) => r.nodeName === "bng-1",
    );
    const bng2 = json.results.find(
      (r: { nodeName: string }) => r.nodeName === "bng-2",
    );
    expect(bng1.ok).toBe(true);
    expect(bng2.ok).toBe(false);
    expect(bng2.message).toBe("Node unreachable");
    expect(bng2.status).toBe(502);
  });

  it("catches exception in health check without failing batch", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockCheckNodeHealth.mockRejectedValue(new Error("dns failure"));

    const res = await POST(makeRequest({ nodeIds: ["n1"], op: "health" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].message).toBe("Node unreachable");
  });

  it("catches exception in bulk-terminate without failing batch", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);

    mockDawosRequest.mockRejectedValue(new Error("timeout"));

    const res = await POST(
      makeRequest({
        nodeIds: ["n1"],
        op: "bulk-terminate",
        params: { usernames: ["alice"] },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].message).toBe("Node unreachable");
  });

  // --- Edge cases ---

  it("passes validation with optional params for non-terminate ops", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockHasRole.mockResolvedValue(true);
    mockPrisma.node.findMany.mockResolvedValue([makeNode("n1", "bng-1")]);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: {} });

    // Restart with params (should be ignored)
    const res = await POST(
      makeRequest({
        nodeIds: ["n1"],
        op: "restart",
        params: { usernames: ["alice"] },
      }),
    );
    expect(res.status).toBe(200);
  });
});
