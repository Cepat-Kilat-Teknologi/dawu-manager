import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockCheckHealth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    node: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  mockCheckHealth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crypto", () => ({ encrypt: (val: string) => `enc-${val}` }));
vi.mock("@/lib/dawos-client", () => ({
  checkNodeHealth: (...args: unknown[]) => mockCheckHealth(...args),
}));

import { GET, POST } from "@/app/api/nodes/route";

const adminSession = {
  user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" },
};
const viewerSession = {
  user: { id: "u2", name: "Viewer", email: "v@t.com", role: "viewer" },
};

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/nodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns node list", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findMany.mockResolvedValue([
      { id: "n1", name: "node-1", url: "http://localhost:8470", status: "online" },
    ]);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("node-1");
  });

  it("allows viewer access", async () => {
    mockAuth.mockResolvedValue(viewerSession);
    mockPrisma.node.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/nodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ name: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for viewer role", async () => {
    mockAuth.mockResolvedValue(viewerSession);
    const res = await POST(
      makePostRequest({ name: "x", url: "http://x", apiKey: "k" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields missing", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await POST(makePostRequest({ name: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid URL", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await POST(
      makePostRequest({ name: "x", url: "not-a-url", apiKey: "k" }),
    );
    expect(res.status).toBe(400);
  });

  it("creates node with encrypted API key", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: true, data: { status: "ok" } });
    mockPrisma.node.create.mockResolvedValue({
      id: "n1", name: "bng-1", url: "http://192.168.1.10:8470",
      location: "Jakarta", tags: null, status: "online",
      lastSeen: new Date(), createdAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await POST(
      makePostRequest({
        name: "bng-1", url: "http://192.168.1.10:8470",
        apiKey: "secret-key", location: "Jakarta",
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.node.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ apiKey: "enc-secret-key", status: "online" }),
    });
  });

  it("sets status offline when health check fails", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: false, data: { error: "Unreachable" } });
    mockPrisma.node.create.mockResolvedValue({
      id: "n1", name: "bng-1", url: "http://192.168.1.10:8470",
      location: null, tags: null, status: "offline",
      lastSeen: null, createdAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await POST(
      makePostRequest({ name: "bng-1", url: "http://192.168.1.10:8470", apiKey: "k" }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.node.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "offline", lastSeen: null }),
    });
  });

  it("returns 409 on duplicate name", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: true, data: {} });
    mockPrisma.node.create.mockRejectedValue(new Error("Unique constraint violation"));
    const res = await POST(
      makePostRequest({ name: "dup", url: "http://x.com:8470", apiKey: "k" }),
    );
    expect(res.status).toBe(409);
  });

  it("creates node with tags when provided", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: true, data: { status: "ok" } });
    mockPrisma.node.create.mockResolvedValue({
      id: "n2", name: "bng-2", url: "http://192.168.1.20:8470",
      location: null, tags: '["prod","jakarta"]', status: "online",
      lastSeen: new Date(), createdAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await POST(
      makePostRequest({
        name: "bng-2", url: "http://192.168.1.20:8470",
        apiKey: "key", tags: ["prod", "jakarta"],
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.node.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tags: JSON.stringify(["prod", "jakarta"]),
      }),
    });
  });

  it("does not set warning header for HTTPS URLs", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: true, data: { status: "ok" } });
    mockPrisma.node.create.mockResolvedValue({
      id: "n3", name: "bng-3", url: "https://bng.myisp.net:8470",
      location: null, tags: null, status: "online",
      lastSeen: new Date(), createdAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await POST(
      makePostRequest({
        name: "bng-3", url: "https://bng.myisp.net:8470",
        apiKey: "key",
      }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("X-Security-Warning")).toBeNull();
  });

  it("returns 400 for non-http protocol URL (SSRF check)", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await POST(
      makePostRequest({ name: "x", url: "ftp://192.168.1.10/file", apiKey: "k" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("HTTP and HTTPS");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockCheckHealth.mockResolvedValue({ ok: true, data: {} });
    mockPrisma.node.create.mockRejectedValue(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      makePostRequest({ name: "x", url: "http://x.com:8470", apiKey: "k" }),
    );
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
