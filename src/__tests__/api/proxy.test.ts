import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockDawosRequest } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    node: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  mockDawosRequest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/dawos-client", () => ({
  dawosRequest: (...args: unknown[]) => mockDawosRequest(...args),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/nodes/[nodeId]/proxy/[...path]/route";

const adminSession = { user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" } };
const viewerSession = { user: { id: "u2", name: "Viewer", email: "v@t.com", role: "viewer" } };
const existingNode = { id: "n1", name: "bng-1", url: "http://192.168.1.10:8470", apiKey: "enc-key" };

const makeParams = (nodeId: string, path: string[]) => ({
  params: Promise.resolve({ nodeId, path }),
});

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/nodes/n1/proxy/sessions", init);
}

describe("Proxy handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await GET(makeRequest("GET"), makeParams("n1", ["sessions"]))).status).toBe(401);
  });

  it("returns 403 for viewer on POST", async () => {
    mockAuth.mockResolvedValue(viewerSession);
    const res = await POST(makeRequest("POST", { action: "terminate" }), makeParams("n1", ["sessions", "1"]));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("read-only");
  });

  it("returns 404 when node not found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(null);
    expect((await GET(makeRequest("GET"), makeParams("n1", ["sessions"]))).status).toBe(404);
  });

  it("proxies GET request and returns data", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: { sessions: [{ id: 1 }] } });

    const res = await GET(makeRequest("GET"), makeParams("n1", ["sessions"]));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sessions).toHaveLength(1);
    expect(mockDawosRequest).toHaveBeenCalledWith(
      "http://192.168.1.10:8470", "enc-key", "sessions",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("joins path segments", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: {} });

    await GET(makeRequest("GET"), makeParams("n1", ["firewall", "groups"]));
    expect(mockDawosRequest).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "firewall/groups", expect.anything(),
    );
  });

  it("proxies POST with body and creates audit log", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 201, data: { id: "new" } });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await POST(makeRequest("POST", { username: "test" }), makeParams("n1", ["sessions"]));
    expect(res.status).toBe(201);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "proxy.post.sessions", userId: "u1", nodeId: "n1" }),
    });
  });

  it("handles 204 No Content response", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 204, data: null });
    mockPrisma.auditLog.create.mockResolvedValue({});

    expect((await DELETE(makeRequest("DELETE"), makeParams("n1", ["sessions", "1"]))).status).toBe(204);
  });

  it("does not audit GET requests", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: {} });

    await GET(makeRequest("GET"), makeParams("n1", ["sessions"]));
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows viewer for GET", async () => {
    mockAuth.mockResolvedValue(viewerSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: {} });

    expect((await GET(makeRequest("GET"), makeParams("n1", ["sessions"]))).status).toBe(200);
  });

  it("proxies PUT with audit log", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: { updated: true } });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await PUT(makeRequest("PUT", { name: "new" }), makeParams("n1", ["config"]));
    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("returns 400 for path traversal with double dots", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await GET(makeRequest("GET"), makeParams("n1", ["..", "etc", "passwd"]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid proxy path.");
  });

  it("returns 400 for path segments with percent encoding", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await GET(makeRequest("GET"), makeParams("n1", ["sessions%00"]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid proxy path.");
  });

  it("returns 400 for empty path segments", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const res = await GET(makeRequest("GET"), makeParams("n1", ["sessions", "", "list"]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid proxy path.");
  });

  it("forwards query string to dawos-agent", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: { sessions: [] } });

    const req = new Request("http://localhost:3000/api/nodes/n1/proxy/sessions?limit=10&offset=0", { method: "GET" });
    await GET(req, makeParams("n1", ["sessions"]));

    expect(mockDawosRequest).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "sessions?limit=10&offset=0", expect.anything(),
    );
  });

  it("does not append query string when absent", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockDawosRequest.mockResolvedValue({ ok: true, status: 200, data: {} });

    await GET(makeRequest("GET"), makeParams("n1", ["sessions"]));

    expect(mockDawosRequest).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "sessions", expect.anything(),
    );
  });
});
