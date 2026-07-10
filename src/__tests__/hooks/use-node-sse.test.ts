import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNodeSSE } from "@/hooks/use-node-sse";

/** Minimal EventSource stub capturing handlers for manual dispatch. */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("useNodeSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects to the BFF stream URL", () => {
    renderHook(() => useNodeSSE("n1", "traffic/sse"));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/nodes/n1/stream/traffic/sse");
  });

  it("starts in connecting state and transitions to open", async () => {
    const { result } = renderHook(() => useNodeSSE("n1", "traffic/sse"));
    expect(result.current.status).toBe("connecting");

    act(() => MockEventSource.instances[0].onopen?.());
    await waitFor(() => expect(result.current.status).toBe("open"));
  });

  it("parses JSON messages and calls onMessage", async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useNodeSSE<{ rx: number }>("n1", "traffic/sse", { onMessage }),
    );

    act(() =>
      MockEventSource.instances[0].onmessage?.({ data: '{"rx": 42}' }),
    );

    await waitFor(() => expect(result.current.lastMessage).toEqual({ rx: 42 }));
    expect(onMessage).toHaveBeenCalledWith({ rx: 42 });
  });

  it("falls back to raw string for non-JSON payloads", async () => {
    const { result } = renderHook(() => useNodeSSE<string>("n1", "logs/stream"));

    act(() =>
      MockEventSource.instances[0].onmessage?.({ data: "plain log line" }),
    );

    await waitFor(() => expect(result.current.lastMessage).toBe("plain log line"));
  });

  it("supports a custom parser", async () => {
    const { result } = renderHook(() =>
      useNodeSSE<number>("n1", "traffic/sse", {
        parse: (raw) => raw.length,
      }),
    );

    act(() => MockEventSource.instances[0].onmessage?.({ data: "abcd" }));
    await waitFor(() => expect(result.current.lastMessage).toBe(4));
  });

  it("sets error status on connection error", async () => {
    const { result } = renderHook(() => useNodeSSE("n1", "traffic/sse"));
    act(() => MockEventSource.instances[0].onerror?.());
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("does not connect when disabled", () => {
    const { result } = renderHook(() =>
      useNodeSSE("n1", "traffic/sse", { enabled: false }),
    );
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe("closed");
  });

  it("closes the source on unmount", () => {
    const { unmount } = renderHook(() => useNodeSSE("n1", "traffic/sse"));
    const source = MockEventSource.instances[0];
    unmount();
    expect(source.closed).toBe(true);
  });

  it("close() stops the stream and sets closed status", async () => {
    const { result } = renderHook(() => useNodeSSE("n1", "traffic/sse"));
    act(() => result.current.close());
    expect(MockEventSource.instances[0].closed).toBe(true);
    await waitFor(() => expect(result.current.status).toBe("closed"));
  });

  it("reconnects when the path changes", () => {
    const { rerender } = renderHook(
      ({ path }: { path: string }) => useNodeSSE("n1", path),
      { initialProps: { path: "traffic/sse" } },
    );
    rerender({ path: "logs/stream" });
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances[1].url).toBe("/api/nodes/n1/stream/logs/stream");
  });
});
