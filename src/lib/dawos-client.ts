import { decrypt } from "@/lib/crypto";

export interface DawosResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * HTTP client for proxying requests to a dawos-agent node.
 * Decrypts the stored API key and injects it as X-API-Key header.
 */
export async function dawosRequest<T = unknown>(
  nodeUrl: string,
  encryptedApiKey: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeout?: number;
  } = {},
): Promise<DawosResponse<T>> {
  const { method = "GET", body, timeout = 30_000 } = options;

  const apiKey = decrypt(encryptedApiKey);
  const url = `${nodeUrl.replace(/\/+$/, "")}/api/v1/${path.replace(/^\/+/, "")}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": apiKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // 204 No Content
    if (res.status === 204) {
      return { ok: true, status: 204, data: null as T };
    }

    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        data: { error: "Request timeout" } as T,
      };
    }
    return {
      ok: false,
      status: 502,
      data: {
        error: "Failed to connect to node",
      } as T,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check node health without authentication (public endpoint).
 */
export async function checkNodeHealth(
  nodeUrl: string,
): Promise<DawosResponse> {
  const url = `${nodeUrl.replace(/\/+$/, "")}/health`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Unreachable" },
    };
  }
}
