/**
 * Dedicated tests for the node IP Pool page.
 * Exercises every branch: loading, error+retry, the genuinely-empty pool state
 * with parsed string usage tiles + overall bar, non-empty pools with usage-bar
 * thresholds and the Remove mutation, remove success toast, and refresh.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
  onSuccess?: () => void;
}

const {
  mockUseNodeProxy,
  mockUseNodeProxyMutation,
  capturedMutations,
  mutationMap,
} = vi.hoisted(() => ({
  mockUseNodeProxy: vi.fn(),
  mockUseNodeProxyMutation: vi.fn(),
  capturedMutations: [] as CapturedMutation[],
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
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/nodes/n1/ip-pool",
  useSearchParams: () => new URLSearchParams(),
}));

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

import IpPoolPage from "@/app/(dashboard)/nodes/[nodeId]/ip-pool/page";

beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (
      _nid: string,
      _path: string,
      opts?: { onSuccess?: () => void; method?: string },
    ) => {
      // Key by path AND method: add (POST) and remove (DELETE) share the
      // "ip-pool" path but are distinct mutations.
      const key = `${_nid}:${_path}:${opts?.method ?? "POST"}`;
      if (!mutationMap.has(key)) {
        const m: CapturedMutation = {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          onSuccess: opts?.onSuccess,
        };
        mutationMap.set(key, m);
        capturedMutations.push(m);
      }
      const existing = mutationMap.get(key)!;
      existing.onSuccess = opts?.onSuccess;
      return existing;
    },
  );
});

describe("IpPoolPage", () => {
  it("shows the loading state (usage tiles hidden until usage loads)", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<IpPoolPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
    // Usage tiles are not shown while usage data is absent.
    expect(screen.queryByText("Used")).toBeNull();
  });

  it("shows the error state and retries", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("pool error"), refetch }),
    );
    render(<IpPoolPage />);
    expect(screen.getAllByText("pool error").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders parsed usage tiles and the genuinely-empty pool message", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ip-pool") return mockQuery({ data: [] });
      if (path === "ip-pool/usage")
        return mockQuery({ data: { used: "0", total: "253", available: "253" } });
      return mockQuery();
    });
    render(<IpPoolPage />);

    // Three tiles with parsed numeric values.
    expect(screen.getByText("Used")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getAllByText("253").length).toBe(2); // Total + Available

    // Overall usage bar (0 used / 253 total → 0%).
    expect(screen.getByText("Overall usage")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();

    // Clear "genuinely empty, not broken" copy.
    expect(
      screen.getByText(
        "No named IP pools defined on this node. 253 addresses available for allocation.",
      ),
    ).toBeTruthy();
  });

  it("renders pools with usage bars across all thresholds and removes a pool", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ip-pool")
        return mockQuery({
          data: [
            { name: "pool-a", range: "10.0.0.0/24", used: 230, available: 24, total: 254 }, // 91% red
            { name: "pool-b", range: "10.1.0.0/24", used: 180, available: 74, total: 254 }, // 71% amber
            { name: "pool-c", range: "10.2.0.0/24", used: 10, available: 244, total: 254 }, // 4% green
            { name: "pool-d", range: "10.3.0.0/24", used: 0, available: 0, total: 0 }, // total 0 → 0%
          ],
        });
      if (path === "ip-pool/usage")
        return mockQuery({ data: { used: "420", total: "1016", available: "596" } });
      return mockQuery();
    });
    render(<IpPoolPage />);

    expect(screen.getByText("pool-a")).toBeTruthy();
    expect(screen.getByText("10.0.0.0/24")).toBeTruthy();
    expect(screen.getByText("91%")).toBeTruthy();
    expect(screen.getByText("71%")).toBeTruthy();
    expect(screen.getByText("4%")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy(); // pool-d row (total 0)
    expect(screen.getByText("41%")).toBeTruthy(); // overall bar (420/1016)

    // Parsed usage tile (comma-formatted thousands).
    expect(screen.getByText("1,016")).toBeTruthy();

    const removeBtns = screen.getAllByText("Remove");
    fireEvent.click(removeBtns[0]);
    expect(capturedMutations[0].mutate).toHaveBeenCalledWith({ name: "pool-a" });
  });

  it("shows a toast when a pool is removed", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ip-pool")
        return mockQuery({
          data: [{ name: "pool-a", range: "10.0.0.0/24", used: 1, available: 1, total: 2 }],
        });
      if (path === "ip-pool/usage")
        return mockQuery({ data: { used: "1", total: "2", available: "1" } });
      return mockQuery();
    });
    render(<IpPoolPage />);
    capturedMutations[0]?.onSuccess?.();
    expect(toast.success).toHaveBeenCalledWith("Pool removed");
  });

  it("refreshes the pool list", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ip-pool")
        return mockQuery({
          data: [{ name: "p", range: "10.0.0.0/24", used: 1, available: 1, total: 2 }],
          refetch,
        });
      if (path === "ip-pool/usage")
        return mockQuery({ data: { used: "1", total: "2", available: "1" } });
      return mockQuery();
    });
    render(<IpPoolPage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalled();
  });

  const withUsage = () =>
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "ip-pool") return mockQuery({ data: [] });
      if (path === "ip-pool/usage")
        return mockQuery({ data: { used: "0", total: "253", available: "253" } });
      return mockQuery();
    });

  it("creates a pool via the Add Pool dialog", () => {
    withUsage();
    render(<IpPoolPage />);
    fireEvent.click(screen.getByText("Add Pool"));
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "soho" },
    });
    fireEvent.change(screen.getByLabelText(/IP range/), {
      target: { value: "10.20.0.0/24" },
    });
    fireEvent.click(screen.getByText("Create Pool"));
    // capturedMutations[1] is the POST (add) mutation.
    expect(capturedMutations[1].mutate).toHaveBeenCalledWith({
      name: "soho",
      ip_range: "10.20.0.0/24",
    });
  });

  it("disables Create until both fields are filled", () => {
    withUsage();
    render(<IpPoolPage />);
    fireEvent.click(screen.getByText("Add Pool"));
    const create = screen.getByText("Create Pool").closest("button")!;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "x" } });
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/IP range/), {
      target: { value: "10.0.0.0/24" },
    });
    expect(create.disabled).toBe(false);
  });

  it("shows a pending spinner and success toast on create", () => {
    withUsage();
    render(<IpPoolPage />);
    // Fire the add mutation's onSuccess (toast + reset).
    capturedMutations[1]?.onSuccess?.();
    expect(toast.success).toHaveBeenCalledWith("Pool created");
  });

  it("cancels the Add Pool dialog", () => {
    withUsage();
    render(<IpPoolPage />);
    fireEvent.click(screen.getByText("Add Pool"));
    expect(screen.getByText("Add IP Pool")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    // Dialog content is unmounted once closed.
    expect(screen.queryByText("Add IP Pool")).toBeNull();
  });

  it("shows Creating… while the add mutation is pending", () => {
    withUsage();
    // Force the POST (add) mutation into a pending state.
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, _path: string, opts?: { onSuccess?: () => void; method?: string }) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: opts?.method === "POST",
        onSuccess: opts?.onSuccess,
      }),
    );
    render(<IpPoolPage />);
    fireEvent.click(screen.getByText("Add Pool"));
    expect(screen.getByText("Creating…")).toBeTruthy();
  });
});
