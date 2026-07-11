import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock useParams since the module has "use client" but hooks need React context
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ nodeId: "n1" }),
}));

import { useNodeProxy, useNodeProxyMutation, ProxyError } from "@/hooks/use-node-proxy";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return QueryWrapper;
}

describe("useNodeProxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("fetches data from proxy URL", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: 42 }),
    } as Response);

    const { result } = renderHook(() => useNodeProxy("n1", "sessions"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ sessions: 42 });
    expect(global.fetch).toHaveBeenCalledWith("/api/nodes/n1/proxy/sessions");
  });

  it("throws ProxyError on non-ok response with error field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useNodeProxy("n1", "sessions"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProxyError);
    expect(result.current.error?.message).toBe("Server error");
    expect((result.current.error as ProxyError).status).toBe(500);
  });

  it("parses detail field from FastAPI responses (e.g. 405)", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 405,
      json: () => Promise.resolve({ detail: "Method Not Allowed" }),
    } as Response);

    const { result } = renderHook(() => useNodeProxy("n1", "firewall/nat/masquerade"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProxyError);
    expect(result.current.error?.message).toBe("Method Not Allowed");
    expect((result.current.error as ProxyError).status).toBe(405);
  });

  it("handles non-ok response without error or detail field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useNodeProxy("n1", "missing"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProxyError);
    expect(result.current.error?.message).toBe("Request failed (404)");
    expect((result.current.error as ProxyError).status).toBe(404);
  });

  it("handles non-ok response with invalid JSON", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error("parse error")),
    } as Response);

    const { result } = renderHook(() => useNodeProxy("n1", "bad"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProxyError);
    expect(result.current.error?.message).toBe("Request failed (502)");
    expect((result.current.error as ProxyError).status).toBe(502);
  });

  it("passes options through", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxy("n1", "logs", { enabled: false }),
      { wrapper: createWrapper() },
    );

    // Should NOT fetch when disabled
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("useNodeProxyMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("sends POST request by default", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation<{ id: string }>("n1", "sessions/terminate"),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ id: "s1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith("/api/nodes/n1/proxy/sessions/terminate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "s1" }),
    });
  });

  it("supports custom HTTP method", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation("n1", "firewall/rules", { method: "DELETE" }),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ ruleId: "r1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("handles 204 no content", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation("n1", "service/restart"),
      { wrapper: createWrapper() },
    );

    result.current.mutate({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("throws ProxyError on non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation("n1", "sessions/terminate"),
      { wrapper: createWrapper() },
    );

    result.current.mutate({});

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProxyError);
    expect(result.current.error?.message).toBe("Forbidden");
    expect((result.current.error as ProxyError).status).toBe(403);
  });

  it("calls onSuccess callback", async () => {
    const onSuccess = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation("n1", "test", { onSuccess }),
      { wrapper: createWrapper() },
    );

    result.current.mutate({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("handles undefined body", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(
      () => useNodeProxyMutation("n1", "test"),
      { wrapper: createWrapper() },
    );

    result.current.mutate(undefined as unknown);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({
      body: undefined,
    });
  });

  it("invalidates queries prefix-aware by first path segment", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Seed a spread of cached queries.
    queryClient.setQueryData(["node-proxy", "n1", "monitoring/status"], { a: 1 });
    queryClient.setQueryData(["node-proxy", "n1", "monitoring/metrics"], { b: 2 });
    queryClient.setQueryData(["node-proxy", "n1", "network/routes"], { c: 3 });
    queryClient.setQueryData(["node-proxy", "n1", "dhcp/status"], { d: 4 });
    queryClient.setQueryData(["node-proxy", "n2", "monitoring/status"], { e: 5 });
    queryClient.setQueryData(["other-cache"], { f: 6 });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      // path segment "monitoring" + explicit cross-module invalidates ["network"]
      () =>
        useNodeProxyMutation("n1", "monitoring/configure", {
          invalidates: ["network"],
        }),
      { wrapper },
    );
    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = (key: unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated;

    // Same module as the mutation path — both refresh.
    expect(invalidated(["node-proxy", "n1", "monitoring/status"])).toBe(true);
    expect(invalidated(["node-proxy", "n1", "monitoring/metrics"])).toBe(true);
    // Cross-module via explicit invalidates.
    expect(invalidated(["node-proxy", "n1", "network/routes"])).toBe(true);
    // Unrelated module on the same node — untouched.
    expect(invalidated(["node-proxy", "n1", "dhcp/status"])).toBe(false);
    // Same module but a different node — untouched.
    expect(invalidated(["node-proxy", "n2", "monitoring/status"])).toBe(false);
    // Non-node-proxy cache — untouched.
    expect(invalidated(["other-cache"])).toBe(false);
  });
});
