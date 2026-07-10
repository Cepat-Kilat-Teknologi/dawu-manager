import { describe, it, expect, vi, beforeEach } from "vitest";
import { dawosRequest, checkNodeHealth } from "@/lib/dawos-client";

// Mock crypto module
vi.mock("@/lib/crypto", () => ({
  decrypt: (val: string) => `decrypted-${val}`,
}));

describe("dawosRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes authenticated GET request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const result = await dawosRequest(
      "http://localhost:8470",
      "encrypted-key",
      "sessions",
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ sessions: [] });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8470/api/v1/sessions",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-API-Key": "decrypted-encrypted-key",
        }),
      }),
    );
  });

  it("makes POST request with body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await dawosRequest(
      "http://localhost:8470/",
      "key",
      "/some/path",
      { method: "POST", body: { name: "test" } },
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8470/api/v1/some/path",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("handles 204 No Content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await dawosRequest(
      "http://localhost:8470",
      "key",
      "sessions/1",
      { method: "DELETE" },
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(result.data).toBeNull();
  });

  it("handles error responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    const result = await dawosRequest(
      "http://localhost:8470",
      "key",
      "sessions/invalid",
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("handles timeout (AbortError)", async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new DOMException("Aborted", "AbortError"),
    );

    const result = await dawosRequest(
      "http://localhost:8470",
      "key",
      "sessions",
      { timeout: 100 },
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(504);
    expect(result.data).toEqual({ error: "Request timeout" });
  });

  it("handles connection failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error("fetch failed"),
    );

    const result = await dawosRequest(
      "http://unreachable:8470",
      "key",
      "sessions",
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.data).toEqual({ error: "Failed to connect to node" });
  });

  it("handles non-Error throw", async () => {
    global.fetch = vi.fn().mockRejectedValue("string error");

    const result = await dawosRequest(
      "http://localhost:8470",
      "key",
      "test",
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.data).toEqual({ error: "Failed to connect to node" });
  });

  it("triggers abort via setTimeout when fetch hangs", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const promise = dawosRequest("http://localhost:8470", "key", "sessions", {
      timeout: 1000,
    });
    await vi.advanceTimersByTimeAsync(1100);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(504);
    vi.useRealTimers();
  });

  it("strips trailing slashes from URL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await dawosRequest(
      "http://localhost:8470///",
      "key",
      "///test///",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8470/api/v1/test///",
      expect.anything(),
    );
  });
});

describe("checkNodeHealth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns health data on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "ok",
          version: "0.3.2",
          uptime_seconds: 12345,
        }),
    });

    const result = await checkNodeHealth("http://localhost:8470");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      status: "ok",
      version: "0.3.2",
      uptime_seconds: 12345,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8470/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns error on unreachable node", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await checkNodeHealth("http://unreachable:8470");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.data).toEqual({ error: "Unreachable" });
  });

  it("strips trailing slash from URL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok" }),
    });

    await checkNodeHealth("http://localhost:8470/");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8470/health",
      expect.anything(),
    );
  });

  it("triggers abort via setTimeout when health fetch hangs", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const promise = checkNodeHealth("http://localhost:8470");
    await vi.advanceTimersByTimeAsync(11000);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    vi.useRealTimers();
  });
});
