import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/nodes/n1",
  useSearchParams: () => new URLSearchParams(),
}));

import { RefreshHealthButton } from "@/components/dashboard/refresh-health-button";

describe("RefreshHealthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders button with correct text", () => {
    render(<RefreshHealthButton nodeId="n1" />);
    expect(screen.getByText("Refresh Health")).toBeInTheDocument();
  });

  it("calls health API and refreshes on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    } as Response);

    render(<RefreshHealthButton nodeId="n1" />);
    fireEvent.click(screen.getByText("Refresh Health"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/nodes/n1/health");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error toast on failed health check", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: "unreachable" }),
    } as Response);

    render(<RefreshHealthButton nodeId="n1" />);
    fireEvent.click(screen.getByText("Refresh Health"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error toast on fetch exception", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network error"));

    render(<RefreshHealthButton nodeId="n1" />);
    fireEvent.click(screen.getByText("Refresh Health"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/nodes/n1/health");
    });
  });

  it("shows loading state while checking", async () => {
    let resolveHealth: (v: Response) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveHealth = resolve;
      }),
    );

    render(<RefreshHealthButton nodeId="n1" />);
    fireEvent.click(screen.getByText("Refresh Health"));

    expect(screen.getByText("Checking...")).toBeInTheDocument();

    resolveHealth!({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText("Refresh Health")).toBeInTheDocument();
    });
  });
});
