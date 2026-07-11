import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    alertEvent: { findMany: vi.fn(), create: vi.fn() },
    alertRule: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/alerts/events/route";

const session = { user: { id: "u1", name: "op", role: "operator" } };

const validEvent = {
  ruleId: "r1",
  ruleName: "High CPU",
  nodeId: "n1",
  nodeName: "accel-2",
  metric: "cpu_percent",
  value: 95,
  threshold: 90,
  message: "CPU usage 95% > 90%",
};

const getReq = (qs = "") =>
  new Request(`http://localhost:3789/api/alerts/events${qs}`);
const postReq = (body: unknown) =>
  new Request("http://localhost:3789/api/alerts/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(session);
  mockPrisma.alertEvent.findMany.mockResolvedValue([]);
  mockPrisma.alertEvent.create.mockImplementation(async ({ data }) => ({
    id: "e1",
    ...data,
  }));
  mockPrisma.alertRule.findUnique.mockResolvedValue({ webhookUrl: null });
  global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/alerts/events", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await GET(getReq())).status).toBe(401);
  });

  it("defaults the limit to 100", async () => {
    await GET(getReq());
    expect(mockPrisma.alertEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("clamps the limit (max 500, min 1) and handles non-numeric", async () => {
    await GET(getReq("?limit=99999"));
    expect(mockPrisma.alertEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    await GET(getReq("?limit=0"));
    expect(mockPrisma.alertEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    await GET(getReq("?limit=abc"));
    expect(mockPrisma.alertEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe("POST /api/alerts/events", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(postReq(validEvent))).status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(postReq({ ruleId: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const req = new Request("http://localhost:3789/api/alerts/events", {
      method: "POST",
      body: "{not json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("records an event without dispatching a webhook when none is set", async () => {
    const res = await POST(postReq(validEvent));
    expect(res.status).toBe(201);
    expect(mockPrisma.alertEvent.create).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not dispatch when the rule no longer exists", async () => {
    mockPrisma.alertRule.findUnique.mockResolvedValue(null);
    const res = await POST(postReq(validEvent));
    expect(res.status).toBe(201);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dispatches the outbound webhook when the rule has one", async () => {
    mockPrisma.alertRule.findUnique.mockResolvedValue({
      webhookUrl: "https://hook.test/z",
    });
    const res = await POST(postReq(validEvent));
    expect(res.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://hook.test/z",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.text).toContain("High CPU");
  });

  it("swallows webhook delivery errors", async () => {
    mockPrisma.alertRule.findUnique.mockResolvedValue({
      webhookUrl: "https://hook.test/z",
    });
    global.fetch = vi.fn().mockRejectedValue(new Error("webhook down"));
    const res = await POST(postReq(validEvent));
    expect(res.status).toBe(201);
  });
});
