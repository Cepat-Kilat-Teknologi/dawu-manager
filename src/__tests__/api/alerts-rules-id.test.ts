import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockHasRole, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHasRole: vi.fn(),
  mockPrisma: { alertRule: { update: vi.fn(), delete: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/auth-guard", () => ({ hasRole: (r: string) => mockHasRole(r) }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { PUT, DELETE } from "@/app/api/alerts/rules/[id]/route";

const session = { user: { id: "u1", name: "op", role: "operator" } };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function put(body: unknown): Request {
  return new Request("http://localhost:3789/api/alerts/rules/r1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(session);
  mockHasRole.mockResolvedValue(true);
  mockPrisma.alertRule.update.mockImplementation(async ({ data }) => ({
    id: "r1",
    ...data,
  }));
  mockPrisma.alertRule.delete.mockResolvedValue({ id: "r1" });
});

describe("PUT /api/alerts/rules/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await PUT(put({}), params("r1"))).status).toBe(401);
  });

  it("returns 403 for insufficient role", async () => {
    mockHasRole.mockResolvedValue(false);
    expect((await PUT(put({ enabled: false }), params("r1"))).status).toBe(403);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await PUT(put({ metric: "nope" }), params("r1"));
    expect(res.status).toBe(400);
  });

  it("updates a rule, mapping null scope/webhook to undefined", async () => {
    const res = await PUT(
      put({ enabled: false, nodeId: null, webhookUrl: null }),
      params("r1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.alertRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { enabled: false, nodeId: undefined, webhookUrl: undefined },
    });
  });

  it("keeps explicit scope and webhook values", async () => {
    await PUT(put({ nodeId: "n2", webhookUrl: "https://h.test/y" }), params("r1"));
    expect(mockPrisma.alertRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { nodeId: "n2", webhookUrl: "https://h.test/y" },
    });
  });

  it("returns 404 when the rule does not exist", async () => {
    mockPrisma.alertRule.update.mockRejectedValue(new Error("not found"));
    const res = await PUT(put({ enabled: true }), params("missing"));
    expect(res.status).toBe(404);
  });

  it("treats a non-JSON body as an empty (no-op) update", async () => {
    const req = new Request("http://localhost:3789/api/alerts/rules/r1", {
      method: "PUT",
      body: "{not json",
    });
    const res = await PUT(req, params("r1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.alertRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { nodeId: undefined, webhookUrl: undefined },
    });
  });
});

describe("DELETE /api/alerts/rules/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await DELETE(put({}), params("r1"))).status).toBe(401);
  });

  it("returns 403 for insufficient role", async () => {
    mockHasRole.mockResolvedValue(false);
    expect((await DELETE(put({}), params("r1"))).status).toBe(403);
  });

  it("deletes a rule and returns 204", async () => {
    const res = await DELETE(put({}), params("r1"));
    expect(res.status).toBe(204);
    expect(mockPrisma.alertRule.delete).toHaveBeenCalledWith({
      where: { id: "r1" },
    });
  });

  it("returns 404 when the rule does not exist", async () => {
    mockPrisma.alertRule.delete.mockRejectedValue(new Error("not found"));
    const res = await DELETE(put({}), params("missing"));
    expect(res.status).toBe(404);
  });
});
