import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock ConfirmDialog
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-title">{title}</span>
        <span data-testid="confirm-description">{description}</span>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button data-testid="confirm-cancel" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsManager } from "@/components/fleet/operations-manager";

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const NODES_RESPONSE = {
  nodes: [
    { id: "n1", name: "bng-1", url: "http://bng-1:8470", status: "online" },
    { id: "n2", name: "bng-2", url: "http://bng-2:8470", status: "offline" },
  ],
};

const RESULTS_ALL_OK = {
  results: [
    { nodeId: "n1", nodeName: "bng-1", ok: true, status: 200, message: "Healthy" },
    { nodeId: "n2", nodeName: "bng-2", ok: true, status: 200, message: "Healthy" },
  ],
};

const RESULTS_PARTIAL = {
  results: [
    { nodeId: "n1", nodeName: "bng-1", ok: true, status: 200, message: "Service restarted" },
    { nodeId: "n2", nodeName: "bng-2", ok: false, status: 502, message: "Node unreachable" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return nodes on GET, results on POST
  mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
    if (url === "/api/nodes" && (!opts?.method || opts.method === "GET")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(NODES_RESPONSE),
      });
    }
    if (url === "/api/fleet/operations" && opts?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(RESULTS_ALL_OK),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });
  });
  vi.stubGlobal("fetch", mockFetch);
});

describe("OperationsManager", () => {
  it("renders the page title and description", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    expect(screen.getByText("Fleet Operations")).toBeTruthy();
    expect(
      screen.getByText("Run operations across multiple nodes simultaneously"),
    ).toBeTruthy();
  });

  it("shows loading state while fetching nodes", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<OperationsManager />, { wrapper: Wrapper });
    expect(screen.getByText(/Loading nodes/)).toBeTruthy();
  });

  it("shows error message when node fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("Failed to load nodes")).toBeTruthy();
    });
  });

  it("shows error when node fetch returns non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal" }),
    });
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("Failed to load nodes")).toBeTruthy();
    });
  });

  it("shows empty state when no nodes exist", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ nodes: [] }),
      }),
    );
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(
        screen.getByText("No nodes registered. Add nodes first."),
      ).toBeTruthy();
    });
  });

  it("renders node list with checkboxes after loading", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("bng-1")).toBeTruthy();
      expect(screen.getByText("bng-2")).toBeTruthy();
    });
    expect(screen.getByLabelText("Select bng-1")).toBeTruthy();
    expect(screen.getByLabelText("Select bng-2")).toBeTruthy();
  });

  it("toggles individual node selection", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    const cb = screen.getByLabelText("Select bng-1") as HTMLInputElement;
    expect(cb.checked).toBe(false);

    fireEvent.click(cb);
    expect(cb.checked).toBe(true);

    fireEvent.click(cb);
    expect(cb.checked).toBe(false);
  });

  it("select all / deselect all works", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    const selectAll = screen.getByLabelText("Select all nodes") as HTMLInputElement;
    fireEvent.click(selectAll);

    expect(
      (screen.getByLabelText("Select bng-1") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Select bng-2") as HTMLInputElement).checked,
    ).toBe(true);

    // Deselect all
    fireEvent.click(selectAll);
    expect(
      (screen.getByLabelText("Select bng-1") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("shows three operation choices", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    expect(screen.getByLabelText("Refresh Health")).toBeTruthy();
    expect(screen.getByLabelText("Restart Service")).toBeTruthy();
    expect(screen.getByLabelText("Bulk Terminate Sessions")).toBeTruthy();
  });

  it("shows Destructive badges on destructive ops", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    const badges = screen.getAllByText("Destructive");
    expect(badges).toHaveLength(2); // restart + bulk-terminate
  });

  it("shows username input only when bulk-terminate is selected", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });

    // Default is health — no username input
    expect(screen.queryByLabelText("Usernames (comma-separated)")).toBeNull();

    // Switch to bulk-terminate
    fireEvent.click(screen.getByLabelText("Bulk Terminate Sessions"));
    expect(
      screen.getByLabelText("Usernames (comma-separated)"),
    ).toBeTruthy();

    // Switch back to health — input hidden
    fireEvent.click(screen.getByLabelText("Refresh Health"));
    expect(screen.queryByLabelText("Usernames (comma-separated)")).toBeNull();
  });

  it("disables Run button when no nodes selected", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    const btn = screen.getByText("Run Operation");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows error toast for bulk-terminate with no usernames", async () => {
    const { toast } = await import("sonner");
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByLabelText("Bulk Terminate Sessions"));
    fireEvent.click(screen.getByText("Run Operation"));
    expect(toast.error).toHaveBeenCalledWith("Enter at least one username");
  });

  it("runs health check directly without confirm dialog", async () => {
    const { toast } = await import("sonner");
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    // Select a node and run health (non-destructive)
    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    // No confirm dialog
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();

    // Wait for results
    await waitFor(() => {
      expect(screen.getAllByText("Healthy").length).toBeGreaterThanOrEqual(1);
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows confirm dialog for restart (destructive)", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByLabelText("Restart Service"));
    fireEvent.click(screen.getByText("Run Operation"));

    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect(screen.getByTestId("confirm-description").textContent).toContain(
      "Restart accel-ppp on 1 node(s)",
    );
    expect(screen.getByTestId("confirm-description").textContent).toContain(
      "disconnects ALL active PPPoE sessions",
    );
  });

  it("shows confirm dialog for bulk-terminate with username count", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByLabelText("Select bng-2"));
    fireEvent.click(screen.getByLabelText("Bulk Terminate Sessions"));

    const input = screen.getByPlaceholderText("user1, user2, user3");
    fireEvent.change(input, { target: { value: "alice, bob" } });
    fireEvent.click(screen.getByText("Run Operation"));

    expect(screen.getByTestId("confirm-description").textContent).toContain(
      "Terminate 2 session(s) across 2 node(s)",
    );
  });

  it("executes operation after confirm", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      if (url === "/api/fleet/operations" && opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(RESULTS_PARTIAL),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { toast } = await import("sonner");
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByLabelText("Select bng-2"));
    fireEvent.click(screen.getByLabelText("Restart Service"));
    fireEvent.click(screen.getByText("Run Operation"));

    // Confirm dialog appears
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("confirm-btn"));

    // Wait for results table
    await waitFor(() => {
      expect(screen.getByText("Service restarted")).toBeTruthy();
      expect(screen.getByText("Node unreachable")).toBeTruthy();
    });

    // Partial failure toast
    expect(toast.error).toHaveBeenCalledWith(
      "Partial failure: 1 succeeded, 1 failed",
    );
  });

  it("displays results table with OK and Failed indicators", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/succeeded/)).toBeTruthy();
  });

  it("displays failed count when there are failures", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      if (url === "/api/fleet/operations") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(RESULTS_PARTIAL),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select all nodes"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(screen.getByText("1 failed")).toBeTruthy();
      expect(screen.getByText("Failed")).toBeTruthy();
    });
  });

  it("shows mutation error as toast", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      if (url === "/api/fleet/operations" && opts?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { toast } = await import("sonner");
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("shows mutation error with fallback message when json parse fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      if (url === "/api/fleet/operations" && opts?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error("parse error")),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { toast } = await import("sonner");
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Request failed (500)");
    });
  });

  it("renders the future extension note", () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    expect(
      screen.getByText("Cross-node config apply is planned for a future release."),
    ).toBeTruthy();
  });

  it("shows loading spinner while operation is pending", async () => {
    // POST never resolves — keeps mutation in isPending state
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      // POST never resolves
      return new Promise(() => {});
    });

    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(screen.getByText(/Running operation across/)).toBeTruthy();
    });
  });

  it("shows running state in description during re-run with existing results", async () => {
    let postCallCount = 0;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/nodes") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(NODES_RESPONSE),
        });
      }
      if (url === "/api/fleet/operations" && opts?.method === "POST") {
        postCallCount++;
        if (postCallCount === 1) {
          // First run: return results immediately
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(RESULTS_ALL_OK),
          });
        }
        // Second run: never resolves — keeps isPending true with old results
        return new Promise(() => {});
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    // First run
    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(screen.getAllByText("Healthy").length).toBeGreaterThanOrEqual(1);
    });

    // Second run (re-run same op) — isPending while results exist
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      expect(screen.getByText(/Running operation across/)).toBeTruthy();
    });
  });

  it("sends correct payload for bulk-terminate with usernames", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByLabelText("Bulk Terminate Sessions"));

    const input = screen.getByPlaceholderText("user1, user2, user3");
    fireEvent.change(input, { target: { value: "alice, bob, " } });
    fireEvent.click(screen.getByText("Run Operation"));

    // Confirm
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (c: unknown[]) =>
          c[0] === "/api/fleet/operations" &&
          (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.op).toBe("bulk-terminate");
      expect(body.params.usernames).toEqual(["alice", "bob"]);
      // trailing comma/space filtered out
    });
  });

  it("does not send params for health operation", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    fireEvent.click(screen.getByLabelText("Select bng-1"));
    fireEvent.click(screen.getByText("Run Operation"));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (c: unknown[]) =>
          c[0] === "/api/fleet/operations" &&
          (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.op).toBe("health");
      expect(body.params).toBeUndefined();
    });
  });

  it("shows node status badges", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("online")).toBeTruthy();
      expect(screen.getByText("offline")).toBeTruthy();
    });
  });

  it("shows selection count in card description", async () => {
    render(<OperationsManager />, { wrapper: Wrapper });
    await waitFor(() => screen.getByText("bng-1"));

    expect(screen.getByText(/0 of 2 selected/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Select bng-1"));
    expect(screen.getByText(/1 of 2 selected/)).toBeTruthy();
  });
});
