/**
 * Tests for the RADIUS diagnostics page.
 * Covers: config display (read-only), status display, health check mutation
 * (success/failure/error), key-value rendering, SKIP_KEYS filtering,
 * loading/error states, and refresh.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import "@/__tests__/ui-mocks";

interface CapturedMutation {
  mutate: Mock;
  mutateAsync: Mock;
  isPending: boolean;
  onSuccess?: () => void;
}

const { mockUseNodeProxy, mockUseNodeProxyMutation, mutationMap } = vi.hoisted(
  () => ({
    mockUseNodeProxy: vi.fn(),
    mockUseNodeProxyMutation: vi.fn(),
    mutationMap: new Map<string, CapturedMutation>(),
  }),
);

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

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

import RadiusPage from "@/app/(dashboard)/nodes/[nodeId]/radius/page";

function mockPaths(opts: {
  config?: unknown;
  status?: unknown;
  refetch?: () => void;
}) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "radius/config")
      return mockQuery({
        data: opts.config ?? null,
        refetch: opts.refetch ?? vi.fn(),
      });
    if (path === "radius/status")
      return mockQuery({
        data: opts.status ?? null,
        refetch: opts.refetch ?? vi.fn(),
      });
    return mockQuery();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      if (!mutationMap.has(path)) {
        mutationMap.set(path, {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          onSuccess: opts?.onSuccess,
        });
      }
      const m = mutationMap.get(path)!;
      m.onSuccess = opts?.onSuccess;
      return m;
    },
  );
});

describe("RadiusPage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<RadiusPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state and retries both sections", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("radius down"), refetch }),
    );
    render(<RadiusPage />);
    expect(
      screen.getAllByText("radius down").length,
    ).toBeGreaterThanOrEqual(1);
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(2);
    retries.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("renders RADIUS config as key-value pairs with security note", () => {
    mockPaths({
      config: {
        auth_server: "10.0.0.1",
        auth_port: 1812,
        acct_server: "10.0.0.1",
        acct_port: 1813,
      },
      status: null,
    });
    render(<RadiusPage />);
    expect(screen.getByText("RADIUS Configuration")).toBeTruthy();
    expect(
      screen.getByText(
        "Read-only view. Shared secrets are never exposed via the API.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("auth server")).toBeTruthy();
    expect(screen.getAllByText("10.0.0.1").length).toBe(2);
    expect(screen.getByText("auth port")).toBeTruthy();
    // formatValue() calls .toLocaleString() on numbers → "1,812"
    expect(screen.getAllByText("1,812").length).toBeGreaterThanOrEqual(1);
  });

  it("renders RADIUS status as key-value pairs", () => {
    mockPaths({
      config: null,
      status: {
        connected: true,
        requests_sent: 500,
        responses_received: 498,
      },
    });
    render(<RadiusPage />);
    expect(screen.getByText("RADIUS Status")).toBeTruthy();
    expect(screen.getByText("connected")).toBeTruthy();
    expect(screen.getByText("requests sent")).toBeTruthy();
    expect(screen.getByText("500")).toBeTruthy();
  });

  it("filters raw_output from config display", () => {
    mockPaths({
      config: { auth_server: "10.0.0.1", raw_output: "noisy raw text" },
      status: null,
    });
    render(<RadiusPage />);
    expect(screen.getByText("auth server")).toBeTruthy();
    expect(screen.queryByText("noisy raw text")).toBeNull();
  });

  it("shows 'No data available' for empty config", () => {
    mockPaths({ config: {}, status: null });
    render(<RadiusPage />);
    expect(screen.getAllByText("No data available").length).toBeGreaterThanOrEqual(1);
  });

  it("runs health check successfully", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi.fn().mockResolvedValue({
      success: true,
      message: "RADIUS OK",
      latency_ms: 12,
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(hcMutation.mutateAsync).toHaveBeenCalledWith({});
    expect(screen.getByText("RADIUS server is healthy")).toBeTruthy();
    expect(screen.getByText("12ms")).toBeTruthy();
    expect(screen.getByText("RADIUS OK")).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("RADIUS health check passed", {
      description: "Latency: 12ms",
    });
  });

  it("runs health check with failure result", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi.fn().mockResolvedValue({
      success: false,
      message: "Connection refused",
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(screen.getByText("Health check failed")).toBeTruthy();
    expect(screen.getByText("Connection refused")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("RADIUS health check failed", {
      description: "Connection refused",
    });
  });

  it("handles health check with no message (fallback)", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi.fn().mockResolvedValue({
      success: false,
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(toast.error).toHaveBeenCalledWith("RADIUS health check failed", {
      description: "Unknown error",
    });
  });

  it("handles health check request error", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("network error"));

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(toast.error).toHaveBeenCalledWith("Health check request failed");
  });

  it("renders extra health check fields", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi.fn().mockResolvedValue({
      success: true,
      latency_ms: 5,
      server_type: "FreeRADIUS",
      version: "3.2.6",
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(screen.getByText("server type")).toBeTruthy();
    expect(screen.getByText("FreeRADIUS")).toBeTruthy();
    expect(screen.getByText("version")).toBeTruthy();
    expect(screen.getByText("3.2.6")).toBeTruthy();
  });

  it("shows health check success without latency description", async () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    const hcMutation = mutationMap.get("radius/health-check")!;
    hcMutation.mutateAsync = vi.fn().mockResolvedValue({
      success: true,
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Run Health Check"));
    });

    expect(toast.success).toHaveBeenCalledWith("RADIUS health check passed", {
      description: undefined,
    });
  });

  it("shows onSuccess toast from mutation", () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    mutationMap.get("radius/health-check")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("RADIUS health check sent");
  });

  it("refreshes config and status sections", () => {
    const refetch = vi.fn();
    mockPaths({
      config: { auth_server: "10.0.0.1" },
      status: { connected: true },
      refetch,
    });
    render(<RadiusPage />);
    const refreshButtons = screen.getAllByText("Refresh");
    expect(refreshButtons.length).toBe(2);
    refreshButtons.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders RADIUS Health Check heading and description", () => {
    mockPaths({ config: null, status: null });
    render(<RadiusPage />);
    expect(screen.getByText("RADIUS Health Check")).toBeTruthy();
    expect(
      screen.getByText(/Test connectivity to the configured RADIUS server/),
    ).toBeTruthy();
  });

  it("disables health check button while pending", () => {
    mockPaths({ config: null, status: null });
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, _path: string, opts?: { onSuccess?: () => void }) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: true,
        onSuccess: opts?.onSuccess,
      }),
    );
    render(<RadiusPage />);
    expect(screen.getByText("Checking…")).toBeTruthy();
    const btn = screen.getByText("Checking…").closest("button");
    expect(btn?.disabled).toBe(true);
  });
});
