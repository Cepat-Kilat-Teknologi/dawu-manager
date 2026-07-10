"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

/**
 * Error class for proxy responses with HTTP status context.
 * Allows UI components to show status-specific guidance (e.g. 405, 404, 502).
 */
export class ProxyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProxyError";
    this.status = status;
  }
}

/**
 * Build the proxy URL for a given node and dawos-agent path.
 * @param nodeId - The node ID from the database
 * @param path - The dawos-agent API path (e.g. "sessions", "firewall/rules")
 */
function proxyUrl(nodeId: string, path: string): string {
  return `/api/nodes/${nodeId}/proxy/${path}`;
}

/** Options for useNodeProxy hook. */
interface ProxyQueryOptions<T>
  extends Partial<
    Pick<
      UseQueryOptions<T>,
      "enabled" | "refetchInterval" | "staleTime" | "retry"
    >
  > {
  /**
   * Extract a nested array from wrapped dawos-agent responses.
   * Most dawos-agent list endpoints return `{ count, <key>: [...] }`.
   * Pass the key name (e.g. "sessions") to auto-unwrap the array.
   * When the key is missing or response is already an array, returns as-is.
   */
  extract?: string;
}

/**
 * TanStack Query hook for GET requests through the node proxy.
 * Fetches data from a dawos-agent endpoint via the Next.js proxy.
 *
 * @param nodeId - Node database ID
 * @param path - dawos-agent API path (e.g. "sessions", "system/info")
 * @param options - Additional TanStack Query options (+ optional `extract` key)
 * @returns Standard useQuery result with typed data
 */
export function useNodeProxy<T = unknown>(
  nodeId: string,
  path: string,
  options?: ProxyQueryOptions<T>,
) {
  const { extract, ...queryOptions } = options ?? {};

  return useQuery<T>({
    queryKey: ["node-proxy", nodeId, path],
    queryFn: async () => {
      const res = await fetch(proxyUrl(nodeId, path));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as Record<string, string>).error ||
          (body as Record<string, string>).detail ||
          `Request failed (${res.status})`;
        throw new ProxyError(msg, res.status);
      }
      const json = await res.json();
      // Auto-unwrap dawos-agent wrapped responses: { count, <key>: [...] }
      if (extract && json && typeof json === "object" && !Array.isArray(json)) {
        const nested = (json as Record<string, unknown>)[extract];
        if (nested !== undefined) return nested as T;
      }
      return json as T;
    },
    ...queryOptions,
  });
}

/** Options for proxy mutation requests. */
interface ProxyMutationOptions {
  /** HTTP method (default: POST). */
  method?: "POST" | "PUT" | "DELETE" | "PATCH";
  /** Query keys to invalidate on success (paths relative to node-proxy). */
  invalidates?: string[];
  /** Callback invoked on successful mutation. */
  onSuccess?: () => void;
}

/**
 * TanStack Query mutation hook for write operations through the node proxy.
 * Sends POST/PUT/DELETE/PATCH requests to a dawos-agent endpoint.
 * Automatically invalidates related query cache on success.
 *
 * @param nodeId - Node database ID
 * @param path - dawos-agent API path (e.g. "sessions/terminate")
 * @param options - Mutation configuration
 * @returns Standard useMutation result
 */
export function useNodeProxyMutation<TBody = unknown, TResponse = unknown>(
  nodeId: string,
  path: string,
  options?: ProxyMutationOptions,
) {
  const queryClient = useQueryClient();
  const { method = "POST", invalidates = [], onSuccess } = options ?? {};

  return useMutation<TResponse, Error, TBody>({
    mutationFn: async (body: TBody) => {
      const res = await fetch(proxyUrl(nodeId, path), {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (data as Record<string, string>).error ||
          (data as Record<string, string>).detail ||
          `Request failed (${res.status})`;
        throw new ProxyError(msg, res.status);
      }
      if (res.status === 204) return null as TResponse;
      return res.json();
    },
    onSuccess: () => {
      // Invalidate specified paths and the base path
      const pathsToInvalidate = [path.split("/")[0], ...invalidates];
      const unique = [...new Set(pathsToInvalidate)];
      for (const p of unique) {
        queryClient.invalidateQueries({
          queryKey: ["node-proxy", nodeId, p],
          exact: false,
        });
      }
      onSuccess?.();
    },
  });
}
