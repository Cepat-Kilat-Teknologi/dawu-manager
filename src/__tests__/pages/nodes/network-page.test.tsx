/**
 * Dedicated tests for the Network page + its CRUD controls.
 *
 * Covers:
 *  - Interface link-state derivation: UP/DOWN pass-through, UNKNOWN+UP/LOWER_UP
 *    flags → UP, UNKNOWN with no up-flag → DOWN, other/missing values kept raw.
 *  - Read rendering: derived IPv4·IPv6, mac_address, link type, VLAN junk filter,
 *    DNS nameservers / search_domains, empty + error + retry + refresh states.
 *  - Route CRUD: add-route dialog (validation, optional device/metric, success +
 *    error), per-row delete (with + without gateway, success + error).
 *  - VLAN CRUD: add-vlan dialog (validation, optional address, success + error),
 *    per-row delete by name path-param (success + error).
 *
 * `useNodeProxy` and `useNodeProxyMutation` are both mocked; mutations are captured
 * per `nodeId:path:method` so each write can be asserted independently.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
}

const { mockUseNodeProxy, mockUseNodeProxyMutation, mutationMap } = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
  mockUseNodeProxyMutation: vi.fn(),
  mutationMap: new Map<string, CapturedMutation>(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return {
    ...actual,
    useNodeProxy: mockUseNodeProxy,
    useNodeProxyMutation: mockUseNodeProxyMutation,
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ nodeId: "n1" }),
}));

import NetworkPage from "@/app/(dashboard)/nodes/[nodeId]/network/page";

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

function makeMutation(): CapturedMutation {
  return { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
}

/** Retrieve the captured mutation for a given path + HTTP method. */
function getMutation(path: string, method: string): CapturedMutation {
  return mutationMap.get(`n1:${path}:${method}`)!;
}

/** Click a per-row delete button then its confirm button; returns the confirm click. */
function confirmDelete(label: string) {
  fireEvent.click(screen.getByLabelText(label));
  const footer = screen.getByTestId("dialog-footer");
  const confirmBtn = footer.querySelector("[data-variant='destructive']") as HTMLElement;
  fireEvent.click(confirmBtn);
}

// Interfaces engineered to exercise every branch of deriveLinkState().
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
  { name: "ens99", state: "DOWN", mtu: 1500 },
  {
    name: "ppp0",
    state: "UNKNOWN",
    link_type: "ppp",
    flags: ["POINTOPOINT", "UP", "LOWER_UP"],
    addresses: [{ family: "inet", address: "10.64.0.1", prefix_len: 32 }],
  },
  { name: "ppp1", state: "UNKNOWN", flags: ["LOWER_UP"] },
  { name: "ppp2", state: "UNKNOWN", flags: ["POINTOPOINT"] },
  { name: "ppp3", state: "UNKNOWN" },
  { name: "wg0", state: "DORMANT" },
  { name: "lo0" },
];

const ROUTES = [
  {
    destination: "default",
    gateway: "192.168.212.225",
    device: "ens21",
    protocol: "",
    metric: null,
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
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (nid: string, path: string, opts?: { method?: string }) => {
      const key = `${nid}:${path}:${opts?.method ?? "POST"}`;
      if (!mutationMap.has(key)) mutationMap.set(key, makeMutation());
      return mutationMap.get(key)!;
    },
  );
});

describe("NetworkPage — read views", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<NetworkPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("derives interface link state from flags (ppp UNKNOWN → UP/DOWN, raw kept)", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "network/interfaces") return mockQuery({ data: INTERFACES });
      if (path === "network/dns") return mockQuery({ data: {} });
      return mockQuery({ data: [] });
    });
    render(<NetworkPage />);

    expect(screen.getByText("Interfaces (8)")).toBeTruthy();
    // UP: ens18 (real UP), ppp0 (flag UP), ppp1 (flag LOWER_UP).
    expect(screen.getAllByText("UP").length).toBe(3);
    // DOWN: ens99 (real DOWN), ppp2 (flags, no up), ppp3 (no flags at all).
    expect(screen.getAllByText("DOWN").length).toBe(3);
    // Unrecognised state passes through raw; ppp UNKNOWN is gone.
    expect(screen.getByText("DORMANT")).toBeTruthy();
    expect(screen.queryByText("UNKNOWN")).toBeNull();
    // Derived addresses + passthrough fields.
    expect(screen.getByText("10.0.0.1/24")).toBeTruthy();
    expect(screen.getByText("fe80::1/64")).toBeTruthy();
    expect(screen.getByText("10.64.0.1/32")).toBeTruthy();
    expect(screen.getByText("bc:24:11:1a:85:88")).toBeTruthy();
    expect(screen.getByText("ether")).toBeTruthy();
    expect(screen.getByText("ppp")).toBeTruthy();
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

describe("NetworkPage — route CRUD", () => {
  it("validates required destination/gateway and the optional metric", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add Route"));
    expect(screen.getByText("Add a static kernel route on this node.")).toBeTruthy();

    const dest = screen.getByPlaceholderText("10.0.0.0/24 or default");
    const form = dest.closest("form")!;

    // Both empty → first operand of the required check.
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Destination and gateway are required.",
    );

    // Destination present, gateway empty → second operand.
    fireEvent.change(dest, { target: { value: "10.9.0.0/24" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Destination and gateway are required.",
    );

    // Non-numeric metric is rejected.
    fireEvent.change(screen.getByPlaceholderText("192.168.1.1"), {
      target: { value: "10.9.0.1" },
    });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "abc" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Metric must be a non-negative integer.",
    );

    expect(getMutation("network/routes", "POST").mutate).not.toHaveBeenCalled();
  });

  it("submits the full route body, toasts, and closes on success", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add Route"));

    fireEvent.change(screen.getByPlaceholderText("10.0.0.0/24 or default"), {
      target: { value: "10.9.0.0/24" },
    });
    fireEvent.change(screen.getByPlaceholderText("192.168.1.1"), {
      target: { value: "10.9.0.1" },
    });
    fireEvent.change(screen.getByPlaceholderText("ens19"), { target: { value: "ens20" } });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "50" } });
    fireEvent.submit(screen.getByPlaceholderText("10.0.0.0/24 or default").closest("form")!);

    const add = getMutation("network/routes", "POST");
    const [body, opts] = add.mutate.mock.calls[0];
    expect(body).toEqual({
      destination: "10.9.0.0/24",
      gateway: "10.9.0.1",
      device: "ens20",
      metric: 50,
    });

    act(() => opts.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("Route added", {
      description: "10.9.0.0/24 via 10.9.0.1",
    });
    // Dialog closed after success.
    expect(screen.queryByText("Add a static kernel route on this node.")).toBeNull();
  });

  it("omits optional device/metric and toasts on error", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add Route"));

    fireEvent.change(screen.getByPlaceholderText("10.0.0.0/24 or default"), {
      target: { value: "172.16.0.0/16" },
    });
    fireEvent.change(screen.getByPlaceholderText("192.168.1.1"), {
      target: { value: "172.16.0.1" },
    });
    fireEvent.submit(screen.getByPlaceholderText("10.0.0.0/24 or default").closest("form")!);

    const add = getMutation("network/routes", "POST");
    const [body, opts] = add.mutate.mock.calls[0];
    expect(body).toEqual({ destination: "172.16.0.0/16", gateway: "172.16.0.1" });

    act(() => opts.onError(new Error("kernel refused")));
    expect(toast.error).toHaveBeenCalledWith("Failed to add route", {
      description: "kernel refused",
    });
  });

  it("closes the Add Route dialog on cancel", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add Route"));
    expect(screen.getByText("Add a static kernel route on this node.")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add a static kernel route on this node.")).toBeNull();
  });

  it("deletes a route with a gateway (confirm → body carries gateway)", async () => {
    fullMock();
    render(<NetworkPage />);
    confirmDelete("Delete route default");

    const del = getMutation("network/routes", "DELETE");
    await waitFor(() => expect(del.mutate).toHaveBeenCalled());
    const [body, opts] = del.mutate.mock.calls[0];
    expect(body).toEqual({ destination: "default", gateway: "192.168.212.225" });

    act(() => opts.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("Route deleted");
    act(() => opts.onError(new Error("busy")));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete route", {
      description: "busy",
    });
  });

  it("deletes a route without a gateway (body omits gateway)", async () => {
    fullMock();
    render(<NetworkPage />);
    confirmDelete("Delete route 10.0.0.0/24");

    const del = getMutation("network/routes", "DELETE");
    await waitFor(() => expect(del.mutate).toHaveBeenCalled());
    expect(del.mutate.mock.calls[0][0]).toEqual({ destination: "10.0.0.0/24" });
  });
});

describe("NetworkPage — VLAN CRUD", () => {
  it("validates parent and a positive integer VLAN id", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add VLAN"));

    const parent = screen.getByPlaceholderText("ens18");
    const form = parent.closest("form")!;

    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("Parent interface is required.");

    fireEvent.change(parent, { target: { value: "ens18" } });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "0" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "VLAN ID must be a positive integer.",
    );

    expect(getMutation("network/vlans", "POST").mutate).not.toHaveBeenCalled();
  });

  it("adds a VLAN with an address, toasts, and closes on success", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add VLAN"));

    fireEvent.change(screen.getByPlaceholderText("ens18"), { target: { value: "ens20" } });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "300" } });
    fireEvent.change(screen.getByPlaceholderText("10.10.0.1/24"), {
      target: { value: "10.30.0.1/24" },
    });
    fireEvent.submit(screen.getByPlaceholderText("ens18").closest("form")!);

    const add = getMutation("network/vlans", "POST");
    const [body, opts] = add.mutate.mock.calls[0];
    expect(body).toEqual({ parent: "ens20", vlan_id: 300, address: "10.30.0.1/24" });

    act(() => opts.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("VLAN added", { description: "ens20.300" });
    expect(screen.queryByText("Create a tagged VLAN sub-interface on this node.")).toBeNull();
  });

  it("adds a VLAN without an address and toasts on error", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add VLAN"));

    fireEvent.change(screen.getByPlaceholderText("ens18"), { target: { value: "ens18" } });
    fireEvent.change(screen.getByPlaceholderText("100"), { target: { value: "250" } });
    fireEvent.submit(screen.getByPlaceholderText("ens18").closest("form")!);

    const add = getMutation("network/vlans", "POST");
    const [body, opts] = add.mutate.mock.calls[0];
    expect(body).toEqual({ parent: "ens18", vlan_id: 250 });

    act(() => opts.onError(new Error("exists")));
    expect(toast.error).toHaveBeenCalledWith("Failed to add VLAN", { description: "exists" });
  });

  it("closes the Add VLAN dialog on cancel", () => {
    fullMock();
    render(<NetworkPage />);
    fireEvent.click(screen.getByText("Add VLAN"));
    expect(screen.getByText("Create a tagged VLAN sub-interface on this node.")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(
      screen.queryByText("Create a tagged VLAN sub-interface on this node."),
    ).toBeNull();
  });

  it("deletes a VLAN by name path-param (no body) with success + error toasts", async () => {
    fullMock();
    render(<NetworkPage />);
    confirmDelete("Delete VLAN vlan100");

    const del = getMutation("network/vlans/vlan100", "DELETE");
    await waitFor(() => expect(del.mutate).toHaveBeenCalled());
    expect(del.mutate.mock.calls[0][0]).toBeUndefined();
    const opts = del.mutate.mock.calls[0][1];

    act(() => opts.onSuccess());
    expect(toast.success).toHaveBeenCalledWith("VLAN deleted");
    act(() => opts.onError(new Error("in use")));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete VLAN", {
      description: "in use",
    });
  });
});
