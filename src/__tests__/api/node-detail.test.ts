import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    node: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crypto", () => ({ encrypt: (val: string) => `enc-${val}` }));

import { GET, PUT, DELETE } from "@/app/api/nodes/[nodeId]/route";

const adminSession = { user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" } };
const operatorSession = { user: { id: "u2", name: "Op", email: "o@t.com", role: "operator" } };
const viewerSession = { user: { id: "u3", name: "Viewer", email: "v@t.com", role: "viewer" } };

const makeParams = (nodeId: string) => ({ params: Promise.resolve({ nodeId }) });
const makePutRequest = (body: unknown) => new Request("http://x/api/nodes/n1", {
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const makeDeleteRequest = () => new Request("http://x/api/nodes/n1", { method: "DELETE" });

const existingNode = {
  id: "n1", name: "bng-1", url: "http://192.168.1.10:8470",
  apiKey: "enc-key", location: "Jakarta", tags: null, status: "online",
  lastSeen: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

describe("GET /api/nodes/:nodeId", () => {
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

  it("returns node data", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    const res = await GET(new Request("http://x"), makeParams("n1"));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("bng-1");
  });
});

describe("PUT /api/nodes/:nodeId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await PUT(makePutRequest({ name: "x" }), makeParams("n1"))).status).toBe(401);
  });

  it("returns 403 for viewer", async () => {
    mockAuth.mockResolvedValue(viewerSession);
    expect((await PUT(makePutRequest({ name: "x" }), makeParams("n1"))).status).toBe(403);
  });

  it("returns 404 when node not found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(null);
    expect((await PUT(makePutRequest({ name: "x" }), makeParams("n1"))).status).toBe(404);
  });

  it("updates node fields", async () => {
    mockAuth.mockResolvedValue(operatorSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockResolvedValue({ ...existingNode, name: "bng-2", location: "Surabaya" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await PUT(makePutRequest({ name: "bng-2", location: "Surabaya" }), makeParams("n1"));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("bng-2");
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" }, data: { name: "bng-2", location: "Surabaya" },
    });
  });

  it("updates url, tags, and clears empty location", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockResolvedValue({
      ...existingNode, url: "http://10.0.0.1:8470",
      tags: '["staging"]', location: null,
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await PUT(
      makePutRequest({
        url: "http://10.0.0.1:8470/",
        tags: ["staging"],
        location: "",
      }),
      makeParams("n1"),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: {
        url: "http://10.0.0.1:8470",
        tags: JSON.stringify(["staging"]),
        location: null,
      },
    });
  });

  it("sets tags to null when tags is falsy", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockResolvedValue({ ...existingNode, tags: null });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await PUT(makePutRequest({ tags: null }), makeParams("n1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { tags: null },
    });
  });

  it("encrypts new apiKey on update", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockResolvedValue(existingNode);
    mockPrisma.auditLog.create.mockResolvedValue({});
    await PUT(makePutRequest({ apiKey: "new-key" }), makeParams("n1"));
    expect(mockPrisma.node.update).toHaveBeenCalledWith({
      where: { id: "n1" }, data: { apiKey: "enc-new-key" },
    });
  });

  it("returns 409 on duplicate name", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockRejectedValue(new Error("Unique constraint violation"));
    expect((await PUT(makePutRequest({ name: "dup" }), makeParams("n1"))).status).toBe(409);
  });

  it("returns 400 for invalid URL format on update", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    const res = await PUT(makePutRequest({ url: "not-a-valid-url" }), makeParams("n1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid URL format.");
  });

  it("returns 400 for non-http protocol URL (SSRF check)", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    const res = await PUT(makePutRequest({ url: "ftp://192.168.1.10/file" }), makeParams("n1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("HTTP and HTTPS");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.update.mockRejectedValue(new Error("DB error"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await PUT(makePutRequest({ name: "x" }), makeParams("n1"))).status).toBe(500);
    spy.mockRestore();
  });
});

describe("DELETE /api/nodes/:nodeId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await DELETE(makeDeleteRequest(), makeParams("n1"))).status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(operatorSession);
    expect((await DELETE(makeDeleteRequest(), makeParams("n1"))).status).toBe(403);
  });

  it("returns 404 when node not found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(null);
    expect((await DELETE(makeDeleteRequest(), makeParams("n1"))).status).toBe(404);
  });

  it("deletes node and returns 204", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.node.findUnique.mockResolvedValue(existingNode);
    mockPrisma.node.delete.mockResolvedValue(existingNode);
    mockPrisma.auditLog.create.mockResolvedValue({});
    const res = await DELETE(makeDeleteRequest(), makeParams("n1"));
    expect(res.status).toBe(204);
    expect(mockPrisma.node.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "node.delete", nodeId: null }),
    });
  });
});
