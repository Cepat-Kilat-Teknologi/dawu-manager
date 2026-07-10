import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockAuth, mockPrisma, mockDecrypt } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { node: { findUnique: vi.fn() } },
  mockDecrypt: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crypto", () => ({
  decrypt: (v: string) => mockDecrypt(v),
}));

import { GET } from "@/app/api/nodes/[nodeId]/stream/[...path]/route";

const session = { user: { id: "u1", name: "Op", email: "o@t.com", role: "operator" } };
const node = { url: "http://192.168.1.10:8470/", apiKey: "enc-key" };

const makeParams = (nodeId: string, path: string[]) => ({
  params: Promise.resolve({ nodeId, path }),
});

const makeRequest = (url = "http://localhost:3789/api/nodes/n1/stream/traffic/sse") =>
  new Request(url);

describe("SSE stream passthrough", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDecrypt.mockReturnValue("plain-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams("n1", ["traffic", "sse"]));
    expect(res.status).toBe(401);
  });

  it("rejects path traversal segments", async () => {
    mockAuth.mockResolvedValue(session);
    const res = await GET(makeRequest(), makeParams("n1", ["..", "etc"]));
    expect(res.status).toBe(400);
  });

  it("rejects encoded segments", async () => {
    mockAuth.mockResolvedValue(session);
    const res = await GET(makeRequest(), makeParams("n1", ["traffic%2Fsse"]));
    expect(res.status).toBe(400);
  });

  it("rejects empty segments", async () => {
    mockAuth.mockResolvedValue(session);
    const res = await GET(makeRequest(), makeParams("n1", [""]));
    expect(res.status).toBe(400);
  });

  it("returns 404 when node not found", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams("nX", ["traffic", "sse"]));
    expect(res.status).toBe(404);
  });

  it("pipes the upstream SSE body with stream headers", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {\"rx_mbps\":1}\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const res = await GET(
      makeRequest("http://localhost:3789/api/nodes/n1/stream/traffic/sse?iface=ens18"),
      makeParams("n1", ["traffic", "sse"]),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    // Upstream URL: trailing slash stripped, query forwarded, key injected
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.1.10:8470/api/v1/traffic/sse?iface=ens18");
    expect(init.headers["X-API-Key"]).toBe("plain-key");
    expect(init.headers.Accept).toBe("text/event-stream");
    expect(await res.text()).toContain("rx_mbps");
  });

  it("defaults Content-Type when upstream omits it", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.close();
      },
    });
    const upstream = new Response(body, { status: 200 });
    upstream.headers.delete("Content-Type");
    global.fetch = vi.fn().mockResolvedValue(upstream) as typeof fetch;

    const res = await GET(makeRequest(), makeParams("n1", ["logs", "stream"]));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("returns 502 when the node connection fails", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;

    const res = await GET(makeRequest(), makeParams("n1", ["traffic", "sse"]));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Failed to connect");
  });

  it("maps upstream error status through", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("forbidden", { status: 403 })) as typeof fetch;

    const res = await GET(makeRequest(), makeParams("n1", ["traffic", "sse"]));
    expect(res.status).toBe(403);
  });

  it("returns 502 when upstream is ok but has no body", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);
    const upstream = new Response(null, { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(upstream) as typeof fetch;

    const res = await GET(makeRequest(), makeParams("n1", ["traffic", "sse"]));
    expect(res.status).toBe(502);
  });

  it("aborts the upstream fetch when the client disconnects", async () => {
    mockAuth.mockResolvedValue(session);
    mockPrisma.node.findUnique.mockResolvedValue(node);

    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedSignal = (init as RequestInit).signal ?? undefined;
      const body = new ReadableStream<Uint8Array>({ start() {} });
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    }) as typeof fetch;

    const abortController = new AbortController();
    const request = new Request(
      "http://localhost:3789/api/nodes/n1/stream/traffic/sse",
      { signal: abortController.signal },
    );

    await GET(request, makeParams("n1", ["traffic", "sse"]));
    expect(capturedSignal?.aborted).toBe(false);
    abortController.abort();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
