/**
 * Dedicated tests for the redesigned System page (real accel-2 shapes).
 * Exercises: metrics gauges (nested cpu/memory/disk, colour thresholds, MB/GB
 * formatting, load avg), host identity + computed uptime (unix s / ms / date
 * string / invalid / missing), system/info interfaces (address shapes, is_up),
 * NTP synced badge + fields, LLDP list/empty, loading / error+retry / refresh.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockUseNodeProxy } = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return { ...actual, useNodeProxy: mockUseNodeProxy };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ nodeId: "n1" }),
}));

import SystemPage from "@/app/(dashboard)/nodes/[nodeId]/system/page";

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

/** Mock only system/info; every other endpoint returns an empty query. */
function infoMock(info: Record<string, unknown>) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) =>
    path === "system/info" ? mockQuery({ data: info }) : mockQuery(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNodeProxy.mockReturnValue(mockQuery());
});

describe("SystemPage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<SystemPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders CPU/RAM/Disk gauges from nested metrics (green thresholds, MB+GB)", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "system/metrics") {
        return mockQuery({
          data: {
            cpu: { count: 2, percent: 0, load_avg: [0, 0, 0] },
            memory: { total_mb: 3915, used_mb: 277, available_mb: 3346, percent: 14.5 },
            disk: { total_gb: 21.7, used_gb: 5.8, free_gb: 16, percent: 26.5 },
            timestamp: 123,
          },
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("14.5%")).toBeTruthy();
    expect(screen.getByText("26.5%")).toBeTruthy();
    expect(screen.getByText("2 cores")).toBeTruthy();
    expect(screen.getByText("load 0 / 0 / 0")).toBeTruthy();
    // formatMb: 277 → MB, 3915/3346 → GB
    expect(screen.getByText("277 MB / 3.8 GB")).toBeTruthy();
    expect(screen.getByText("3.3 GB available")).toBeTruthy();
    // formatGb
    expect(screen.getByText("5.8 GB / 21.7 GB")).toBeTruthy();
    expect(screen.getByText("16.0 GB free")).toBeTruthy();
  });

  it("colours gauges by utilisation (red > 90, amber > 70) and handles absent nested data", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "system/metrics") {
        return mockQuery({
          data: {
            cpu: { count: 4, percent: 95 },
            memory: { percent: 80 },
            disk: { percent: 20 },
          },
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("95%")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    // memory + disk have no used/total → formatMb/formatGb(undefined) → "—"
    expect(screen.queryAllByText("— / —").length).toBeGreaterThanOrEqual(1);
    // cpu has no load_avg → "load —"
    expect(screen.getByText("load —")).toBeTruthy();
    const red = document.querySelector(".bg-red-500");
    const amber = document.querySelector(".bg-amber-500");
    const green = document.querySelector(".bg-emerald-500");
    expect(red).toBeTruthy();
    expect(amber).toBeTruthy();
    expect(green).toBeTruthy();
  });

  it("renders host identity + interfaces from system/info", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "system/info") {
        return mockQuery({
          data: {
            hostname: "dawos-dev",
            os: "Ubuntu 22.04.5 LTS",
            kernel: "5.15.0-119-generic",
            arch: "x86_64",
            boot_time: 1751000000,
            interfaces: [
              {
                name: "ens18",
                is_up: true,
                addresses: [
                  "10.0.0.1/24",
                  { address: "10.0.0.2", prefix_len: 24 },
                  { address: "fe80::1" },
                  42,
                ],
              },
              { name: "lo", is_up: false, addresses: [] },
            ],
          },
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("dawos-dev")).toBeTruthy();
    expect(screen.getByText("Ubuntu 22.04.5 LTS")).toBeTruthy();
    expect(screen.getByText("5.15.0-119-generic")).toBeTruthy();
    expect(screen.getByText("x86_64")).toBeTruthy();
    expect(screen.getByText("Uptime")).toBeTruthy();
    // Interfaces section
    expect(screen.getByText("Interfaces (2)")).toBeTruthy();
    expect(screen.getByText("ens18")).toBeTruthy();
    expect(screen.getByText("lo")).toBeTruthy();
    // addressText covers string / {address,prefix_len} / {address} / number
    expect(screen.getByText("10.0.0.1/24, 10.0.0.2/24, fe80::1, 42")).toBeTruthy();
    // is_up true/false badges
    expect(screen.getByText("UP")).toBeTruthy();
    expect(screen.getByText("DOWN")).toBeTruthy();
  });

  it("renders em dashes for missing host identity fields", () => {
    infoMock({});
    render(<SystemPage />);
    expect(screen.getByText("Hostname")).toBeTruthy();
    expect(screen.queryAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("computes uptime from a unix-millisecond boot time", () => {
    infoMock({ boot_time: 1751000000000 });
    render(<SystemPage />);
    expect(screen.getByText("Uptime")).toBeTruthy();
  });

  it("computes uptime from a date-string boot time", () => {
    infoMock({ boot_time: "2026-07-01T00:00:00Z" });
    render(<SystemPage />);
    expect(screen.getByText("Uptime")).toBeTruthy();
  });

  it("renders em dash for an unparseable boot time", () => {
    infoMock({ boot_time: "not-a-date", hostname: "h1" });
    render(<SystemPage />);
    expect(screen.getByText("h1")).toBeTruthy();
    expect(screen.queryAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty interface state", () => {
    infoMock({ interfaces: [] });
    render(<SystemPage />);
    expect(screen.getByText("No interfaces reported.")).toBeTruthy();
  });

  it("renders NTP status with fields and a 'Not synced' badge", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ntp/status") {
        return mockQuery({
          data: {
            synced: false,
            reference: "time.cloudflare.com",
            stratum: 3,
            system_time_offset: "0.001",
            last_offset: "0.002",
            frequency: "-1.5",
            raw_output: "reference id ...",
          },
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("Not synced")).toBeTruthy();
    expect(screen.getByText("Reference")).toBeTruthy();
    expect(screen.getByText("time.cloudflare.com")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders NTP 'Synced' badge with dash fallbacks for missing fields", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ntp/status") return mockQuery({ data: { synced: true } });
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("Synced")).toBeTruthy();
    expect(screen.queryAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("dashes empty-string NTP fields instead of leaving them blank", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ntp/status") {
        return mockQuery({
          data: {
            synced: false,
            reference: "",
            stratum: 0,
            system_time_offset: "",
            last_offset: "",
            frequency: "",
            raw_output: "",
          },
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("Not synced")).toBeTruthy();
    // stratum 0 is a real value → "0"; every empty string field dashes
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.queryAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("renders LLDP neighbours", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "lldp/neighbors") {
        return mockQuery({
          data: [
            {
              local_port: "eth0",
              remote_system: "core-sw",
              remote_port: "Gi0/1",
              remote_description: "Core",
              ttl: 120,
            },
          ],
        });
      }
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("LLDP Neighbors (1)")).toBeTruthy();
    expect(screen.getByText("core-sw")).toBeTruthy();
    expect(screen.getByText("Core")).toBeTruthy();
  });

  it("renders empty LLDP state with a muted explanation note", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "lldp/neighbors") return mockQuery({ data: [] });
      return mockQuery();
    });
    render(<SystemPage />);
    expect(screen.getByText("No LLDP neighbors discovered.")).toBeTruthy();
    expect(
      screen.getByText(
        "LLDP is active; no neighbours are advertising on connected links.",
      ),
    ).toBeTruthy();
  });

  it("retries every section on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(mockQuery({ error: new Error("down"), refetch }));
    render(<SystemPage />);
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(5);
    retries.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(5);
  });

  it("refreshes the metrics and LLDP sections", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "lldp/neighbors") {
        return mockQuery({ data: [{ local_port: "eth0", remote_system: "sw" }], refetch });
      }
      return mockQuery({ data: {}, refetch });
    });
    render(<SystemPage />);
    const refresh = screen.getAllByText("Refresh");
    expect(refresh.length).toBe(2);
    refresh.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
