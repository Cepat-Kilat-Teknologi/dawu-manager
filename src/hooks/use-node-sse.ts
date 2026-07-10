"use client";

import { useEffect, useRef, useState } from "react";

/** Connection status of an SSE stream. */
export type SSEStatus = "connecting" | "open" | "error" | "closed";

/** Options for the useNodeSSE hook. */
interface UseNodeSSEOptions<T> {
  /** Disable the connection (e.g. while a tab is hidden). Default: true. */
  enabled?: boolean;
  /** Parse a raw SSE `data:` payload. Default: JSON.parse with raw-string fallback. */
  parse?: (raw: string) => T;
  /** Callback invoked for every parsed message. */
  onMessage?: (data: T) => void;
}

/**
 * Default SSE payload parser — JSON when possible, raw string otherwise.
 */
function defaultParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

/**
 * Subscribe to a dawos-agent SSE stream through the Next.js BFF
 * (`/api/nodes/:id/stream/:path`). Authentication rides on the session
 * cookie; the node API key never reaches the browser.
 *
 * The browser's EventSource reconnects automatically on network errors.
 *
 * @param nodeId - Node database ID
 * @param path - dawos-agent streaming path (e.g. "traffic/sse")
 * @param options - enable flag, custom parser, per-message callback
 * @returns Last message, connection status, and a manual close function
 */
export function useNodeSSE<T = unknown>(
  nodeId: string,
  path: string,
  options?: UseNodeSSEOptions<T>,
) {
  const { enabled = true, parse, onMessage } = options ?? {};
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [status, setStatus] = useState<SSEStatus>(
    enabled ? "connecting" : "closed",
  );
  const sourceRef = useRef<EventSource | null>(null);
  // Keep callbacks in refs so the connection effect doesn't reconnect on
  // every render; refs are synced after render per the react-hooks/refs rule.
  const onMessageRef = useRef(onMessage);
  const parseRef = useRef(parse);
  useEffect(() => {
    onMessageRef.current = onMessage;
    parseRef.current = parse;
  });

  // Reset status when the connection target changes — React's endorsed
  // "adjust state during render" pattern (avoids setState inside the effect).
  const connectionKey = `${nodeId}|${path}|${enabled}`;
  const [prevKey, setPrevKey] = useState(connectionKey);
  if (prevKey !== connectionKey) {
    setPrevKey(connectionKey);
    setStatus(enabled ? "connecting" : "closed");
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const source = new EventSource(`/api/nodes/${nodeId}/stream/${path}`);
    sourceRef.current = source;

    source.onopen = () => setStatus("open");
    source.onerror = () => setStatus("error");
    source.onmessage = (event: MessageEvent<string>) => {
      const parser = parseRef.current ?? defaultParse<T>;
      const data = parser(event.data) as T;
      setLastMessage(data);
      onMessageRef.current?.(data);
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [nodeId, path, enabled]);

  return {
    lastMessage,
    status,
    close: () => {
      sourceRef.current?.close();
      setStatus("closed");
    },
  };
}
