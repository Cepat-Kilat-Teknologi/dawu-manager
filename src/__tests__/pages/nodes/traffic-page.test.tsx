/**
 * Dedicated tests for the node Traffic page: real-time chart mount + the manual
 * per-user rate-limit override tool (POST/DELETE traffic/ratelimit/{username}).
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

const { mockUseNodeProxyMutation, mutationMap } = vi.hoisted(() => ({
  mockUseNodeProxyMutation: vi.fn(),
  mutationMap: new Map<string, CapturedMutation>(),
}));

vi.mock("@/hooks/use-node-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-node-proxy")>();
  return { ...actual, useNodeProxyMutation: mockUseNodeProxyMutation };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ nodeId: "n1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/nodes/n1/traffic",
  useSearchParams: () => new URLSearchParams(),
}));

// Stub the code-split chart to keep ECharts out of the test.
vi.mock("@/components/charts/traffic-chart-lazy", () => ({
  TrafficChartLazy: () => <div data-testid="traffic-chart" />,
}));

import TrafficPage from "@/app/(dashboard)/nodes/[nodeId]/traffic/page";

let pending = false;
beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  pending = false;
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void; method?: string }) => {
      const key = `${path}:${opts?.method ?? "POST"}`;
      if (!mutationMap.has(key)) {
        mutationMap.set(key, {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: pending,
          onSuccess: opts?.onSuccess,
        });
      }
      const m = mutationMap.get(key)!;
      m.onSuccess = opts?.onSuccess;
      return m;
    },
  );
});

describe("TrafficPage", () => {
  it("mounts the real-time chart and the override tool", () => {
    render(<TrafficPage />);
    expect(screen.getByTestId("traffic-chart")).toBeTruthy();
    expect(screen.getByText("Rate-Limit Override")).toBeTruthy();
  });

  it("disables Apply/Clear until a username is entered", () => {
    render(<TrafficPage />);
    const apply = screen.getByText("Apply").closest("button")!;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "bob" },
    });
    expect(apply.disabled).toBe(false);
  });

  it("applies a rate-limit override to the target user", () => {
    render(<TrafficPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText(/Rate/), { target: { value: "5M/20M" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(mutationMap.get("traffic/ratelimit/bob:POST")!.mutate).toHaveBeenCalledWith({
      rate: "5M/20M",
    });
  });

  it("clears a rate-limit override", () => {
    render(<TrafficPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    fireEvent.click(screen.getByTitle("Clear override"));
    expect(mutationMap.get("traffic/ratelimit/bob:DELETE")!.mutate).toHaveBeenCalledWith(
      undefined,
    );
  });

  it("does not apply when submitted with an empty username", () => {
    render(<TrafficPage />);
    // Submit the form directly (button is disabled) — canSubmit is false.
    const form = screen.getByLabelText("Username").closest("form")!;
    fireEvent.submit(form);
    // The empty-target POST mutation must not have fired.
    expect(mutationMap.get("traffic/ratelimit/:POST")!.mutate).not.toHaveBeenCalled();
  });

  it("shows pending spinners while applying", () => {
    pending = true;
    render(<TrafficPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    expect(screen.getByText("Applying…")).toBeTruthy();
  });

  it("toasts on apply and clear success", () => {
    render(<TrafficPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    mutationMap.get("traffic/ratelimit/bob:POST")!.onSuccess!();
    mutationMap.get("traffic/ratelimit/bob:DELETE")!.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith("Rate limit applied to bob");
    expect(toast.success).toHaveBeenCalledWith("Rate limit override cleared for bob");
  });
});
