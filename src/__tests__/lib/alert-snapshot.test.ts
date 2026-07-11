import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNodeSnapshot } from "@/lib/alert-snapshot";

const OFFLINE = {
  online: false,
  cpu_percent: 0,
  mem_percent: 0,
  disk_percent: 0,
  session_count: 0,
};

function jsonRes(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("fetchNodeSnapshot", () => {
  it("returns an offline snapshot when the metrics fetch is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({}, false));
    expect(await fetchNodeSnapshot("n1")).toEqual(OFFLINE);
  });

  it("returns an offline snapshot when the metrics fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network"));
    expect(await fetchNodeSnapshot("n1")).toEqual(OFFLINE);
  });

  it("assembles an online snapshot from metrics and session stats", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("system/metrics")) {
        return Promise.resolve(
          jsonRes({
            cpu: { percent: 42 },
            memory: { percent: 63 },
            disk: { percent: 88 },
          }),
        );
      }
      return Promise.resolve(jsonRes({ active: "150" }));
    }) as typeof fetch;

    expect(await fetchNodeSnapshot("n1")).toEqual({
      online: true,
      cpu_percent: 42,
      mem_percent: 63,
      disk_percent: 88,
      session_count: 150,
    });
  });

  it("defaults missing metric fields and session count to 0", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("system/metrics")) return Promise.resolve(jsonRes({}));
      return Promise.resolve(jsonRes({}, false));
    }) as typeof fetch;

    expect(await fetchNodeSnapshot("n1")).toEqual({
      online: true,
      cpu_percent: 0,
      mem_percent: 0,
      disk_percent: 0,
      session_count: 0,
    });
  });

  it("keeps session count at 0 when the stats fetch throws", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("system/metrics")) {
        return Promise.resolve(jsonRes({ cpu: { percent: 5 } }));
      }
      return Promise.reject(new Error("stats down"));
    }) as typeof fetch;

    expect(await fetchNodeSnapshot("n1")).toEqual({
      online: true,
      cpu_percent: 5,
      mem_percent: 0,
      disk_percent: 0,
      session_count: 0,
    });
  });
});
