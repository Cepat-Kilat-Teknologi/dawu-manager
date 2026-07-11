/**
 * Dedicated tests for the Network page (rewritten against real accel-2 shapes).
 * Exercises every branch: loading / error+retry / empty / data rendering,
 * derived IPv4·IPv6, mac_address vs mac, device vs interface, VLAN junk filter,
 * and the DNS nameservers / search_domains lists.
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

import NetworkPage from "@/app/(dashboard)/nodes/[nodeId]/network/page";

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

const INTERFACES = [
  {
    name: "ens18",
    state: "UP",
    mtu: 1500,
    mac_address: "bc:24:11:1a:85:88",
    link_type: "ether",
    addresses: [
      { family: "inet", address: "10.0.0.1", prefix_len: 24 },
      { family: "inet6", address: "fe80::1", prefix_len: 64 },
    ],
  },
  {
    name: "ppp0",
    state: "UNKNOWN",
    mtu: 1492,
    mac_address: "",
    link_type: "ppp",
    addresses: [{ family: "inet", address: "10.64.0.1", prefix_len: 32 }],
  },
  { name: "ens99", state: "DOWN", mtu: 1500 },
];

const ROUTES = [
  {
    destination: "default",
    gateway: "192.168.212.225",
    device: "ens21",
    protocol: "",
    scope: "",
    metric: null,
    source: null,
  },
  { destination: "10.0.0.0/24", gateway: "", device: "ens19", protocol: "kernel", metric: 100 },
];

const VLANS = [
  { name: "vlan100", parent: "ens18", vlan_id: 100, protocol: "802.1Q", state: "UP" },
  { name: "mgmt", parent: "", vlan_id: 0, protocol: "", state: "UNKNOWN" },
  { name: "v200", parent: "ens18", vlan_id: 200 },
  { name: "", parent: "", vlan_id: 0, protocol: "802.1Q", state: "UNKNOWN" },
];

const DNS = {
  success: true,
  message: "ok",
  config: { nameservers: ["192.168.212.1", "8.8.8.8"], search_domains: ["lan"] },
};

function fullMock() {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "network/interfaces") return mockQuery({ data: INTERFACES });
    if (path === "network/routes") return mockQuery({ data: ROUTES });
    if (path === "network/vlans") return mockQuery({ data: VLANS });
    if (path === "network/dns") return mockQuery({ data: DNS });
    return mockQuery();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNodeProxy.mockReturnValue(mockQuery());
});

describe("NetworkPage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<NetworkPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders interfaces with mac_address, derived IPv4/IPv6, link type and state badges", () => {
    fullMock();
    render(<NetworkPage />);
    expect(screen.getByText("Interfaces (3)")).toBeTruthy();
    // ens18 is also a VLAN parent below, so it appears more than once
    expect(screen.queryAllByText("ens18").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ppp0")).toBeTruthy();
    expect(screen.getByText("ens99")).toBeTruthy();
    // Derived addresses: `${address}/${prefix_len}`
    expect(screen.getByText("10.0.0.1/24")).toBeTruthy();
    expect(screen.getByText("fe80::1/64")).toBeTruthy();
    expect(screen.getByText("10.64.0.1/32")).toBeTruthy();
    // mac_address (not mac) + link_type
    expect(screen.getByText("bc:24:11:1a:85:88")).toBeTruthy();
    expect(screen.getByText("ether")).toBeTruthy();
    // State badges: UP + UNKNOWN (shared with VLANs) + DOWN
    expect(screen.queryAllByText("UP").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("UNKNOWN").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("DOWN")).toBeTruthy();
    // Missing fields render as em dash (mac undefined on ens99, IPv6 absent on ppp0)
    expect(screen.queryAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders routes reading device (not interface) with dash fallbacks", () => {
    fullMock();
    render(<NetworkPage />);
    expect(screen.getByText("Routes (2)")).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("10.0.0.0/24")).toBeTruthy();
    expect(screen.getByText("192.168.212.225")).toBeTruthy();
    expect(screen.getByText("ens21")).toBeTruthy();
    expect(screen.getByText("kernel")).toBeTruthy();
  });

  it("filters junk VLANs and keeps only real ones", () => {
    fullMock();
    render(<NetworkPage />);
    // 3 real VLANs kept (vlan_id>0 or name), the empty one dropped
    expect(screen.getByText("VLANs (3)")).toBeTruthy();
    expect(screen.getByText("vlan100")).toBeTruthy();
    expect(screen.getByText("mgmt")).toBeTruthy();
    expect(screen.getByText("v200")).toBeTruthy();
  });

  it("renders DNS nameservers and search_domains as labelled lists", () => {
    fullMock();
    render(<NetworkPage />);
    expect(screen.getByText("Nameservers")).toBeTruthy();
    expect(screen.getByText("Search Domains")).toBeTruthy();
    expect(screen.getByText("192.168.212.1")).toBeTruthy();
    expect(screen.getByText("8.8.8.8")).toBeTruthy();
    expect(screen.getByText("lan")).toBeTruthy();
  });

  it("renders empty states and DNS 'None configured' fallback", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/dns") return mockQuery({ data: {} });
      return mockQuery({ data: [] });
    });
    render(<NetworkPage />);
    expect(screen.getByText("No network interfaces found.")).toBeTruthy();
    expect(screen.getByText("No routes configured.")).toBeTruthy();
    expect(screen.getByText("No VLANs configured.")).toBeTruthy();
    expect(screen.queryAllByText("None configured").length).toBe(2);
  });

  it("retries every section on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(mockQuery({ error: new Error("boom"), refetch }));
    render(<NetworkPage />);
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(4);
    retries.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(4);
  });

  it("refreshes the interfaces section", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/interfaces") return mockQuery({ data: INTERFACES, refetch });
      return mockQuery({ data: [] });
    });
    render(<NetworkPage />);
    const refresh = screen.getAllByText("Refresh");
    expect(refresh.length).toBe(1);
    refresh.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalled();
  });
});
