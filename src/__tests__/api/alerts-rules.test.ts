import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockHasRole, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHasRole: vi.fn(),
  mockPrisma: { alertRule: { findMany: vi.fn(), create: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/auth-guard", () => ({ hasRole: (r: string) => mockHasRole(r) }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/alerts/rules/route";

const session = { user: { id: "u1", name: "op", role: "operator" } };

function post(body: unknown): Request {
  return new Request("http://localhost:3789/api/alerts/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(session);
  mockHasRole.mockResolvedValue(true);
  mockPrisma.alertRule.findMany.mockResolvedValue([]);
  mockPrisma.alertRule.create.mockImplementation(async ({ data }) => ({
    id: "r1",
    ...data,
  }));
});

describe("GET /api/alerts/rules", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("lists rules newest first", async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([{ id: "r1", name: "CPU" }]);
    const body = await (await GET()).json();
    expect(body.rules).toHaveLength(1);
    expect(mockPrisma.alertRule.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /api/alerts/rules", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(post({}))).status).toBe(401);
  });

  it("returns 403 for insufficient role", async () => {
    mockHasRole.mockResolvedValue(false);
    expect((await POST(post({ name: "x", metric: "cpu_percent" }))).status).toBe(403);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(post({ name: "", metric: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const req = new Request("http://localhost:3789/api/alerts/rules", {
      method: "POST",
      body: "{not json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("creates a rule with explicit node scope and webhook", async () => {
    const res = await POST(
      post({
        name: "High CPU",
        nodeId: "n1",
        metric: "cpu_percent",
        operator: "gt",
        threshold: 90,
        webhookUrl: "https://hook.test/x",
      }),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.alertRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "High CPU",
        nodeId: "n1",
        metric: "cpu_percent",
        threshold: 90,
        webhookUrl: "https://hook.test/x",
      }),
    });
  });

  it("defaults scope, operator, threshold, enabled and webhook when omitted", async () => {
    await POST(post({ name: "Offline", metric: "node_offline" }));
    expect(mockPrisma.alertRule.create).toHaveBeenCalledWith({
      data: {
        name: "Offline",
        nodeId: null,
        metric: "node_offline",
        operator: "gt",
        threshold: 0,
        enabled: true,
        webhookUrl: null,
      },
    });
  });
});
