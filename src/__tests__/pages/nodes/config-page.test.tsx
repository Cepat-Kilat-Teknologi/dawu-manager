/**
 * Dedicated tests for the node Config page: inline editor, client-side syntax
 * check, guarded apply/confirm/rollback, backups/revisions, and the exported
 * checkConfigSyntax helper.
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

const { mockUseNodeProxy, mockUseNodeProxyMutation, capturedMutations, mutationMap } =
  vi.hoisted(() => ({
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/nodes/n1/config",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    description,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => Promise<void> | void;
    description: string;
    onOpenChange: (o: boolean) => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span data-testid="confirm-desc">{description}</span>
        <button data-testid="confirm-btn" onClick={() => onConfirm()}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    ) : null,
}));

function mockQuery(overrides: Record<string, unknown> = {}) {
  return { data: null, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

import ConfigPage, { checkConfigSyntax } from "@/app/(dashboard)/nodes/[nodeId]/config/page";

let pending = false;
beforeEach(() => {
  vi.clearAllMocks();
  capturedMutations.length = 0;
  mutationMap.clear();
  pending = false;
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      if (!mutationMap.has(path)) {
        const m: CapturedMutation = {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: pending,
          onSuccess: opts?.onSuccess,
        };
        mutationMap.set(path, m);
        capturedMutations.push(m);
      }
      const existing = mutationMap.get(path)!;
      existing.onSuccess = opts?.onSuccess;
      return existing;
    },
  );
});

const loaded = () =>
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "config")
      return mockQuery({
        data: { path: "/etc/accel-ppp.conf", content: "[ppp]\nverbose=1", last_modified: "" },
      });
    if (path === "config/backups")
      return mockQuery({ data: [{ name: "b1", created: "2026-07-01", size: 4096 }] });
    if (path === "config/revisions")
      return mockQuery({ data: [{ name: "r1", created: "2026-07-01", size: 2048 }] });
    return mockQuery({ data: [] });
  });

describe("checkConfigSyntax", () => {
  it("passes a valid config", () => {
    expect(checkConfigSyntax("[core]\nthread-count=2\n# comment\n; c2")).toEqual([]);
  });
  it("flags a malformed section header", () => {
    const issues = checkConfigSyntax("[core\nthread-count=2");
    expect(issues.some((i) => i.includes("malformed section header"))).toBe(true);
  });
  it("flags a file with no sections", () => {
    expect(checkConfigSyntax("verbose=1\n")).toContain("No [section] headers found.");
  });
});

describe("ConfigPage", () => {
  it("shows loading", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<ConfigPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error + retry on every section", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(mockQuery({ error: new Error("cfg err"), refetch }));
    render(<ConfigPage />);
    // config, backups and revisions each render a Retry — exercise all onRetry.
    const retries = screen.getAllByText("Retry");
    expect(retries.length).toBe(3);
    retries.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("renders config, backups (KB) and revisions", () => {
    loaded();
    render(<ConfigPage />);
    expect(screen.getByText("Current Configuration")).toBeTruthy();
    expect(screen.getByText("4 KB")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
  });

  it("edits and applies content through the apply confirmation", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    const ta = screen.getByLabelText("Configuration content") as HTMLTextAreaElement;
    expect(ta.value).toBe("[ppp]\nverbose=1");
    fireEvent.change(ta, { target: { value: "[ppp]\nverbose=5" } });
    fireEvent.click(screen.getByText("Save & Apply"));
    // Apply is now gated behind an impact-explicit confirmation.
    expect(screen.getByTestId("confirm-desc").textContent).toContain("guard timer");
    await act(async () => fireEvent.click(screen.getByTestId("confirm-btn")));
    expect(mutationMap.get("config/apply")!.mutateAsync).toHaveBeenCalledWith({
      content: "[ppp]\nverbose=5",
    });
  });

  it("checks syntax — success toast for valid draft", () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Check syntax"));
    expect(toast.success).toHaveBeenCalledWith(
      "Syntax check passed",
      expect.anything(),
    );
  });

  it("checks syntax — error toast for invalid draft", () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Configuration content"), {
      target: { value: "[bad\noops" },
    });
    fireEvent.click(screen.getByText("Check syntax"));
    expect(toast.error).toHaveBeenCalled();
  });

  it("cancels edit mode", () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("Configuration content")).toBeNull();
  });

  it("confirms and rolls back via dialogs", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain("Confirm the currently");
    await act(async () => fireEvent.click(screen.getByTestId("confirm-btn")));
    expect(mutationMap.get("config/confirm")!.mutateAsync).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Rollback"));
    expect(screen.getByTestId("confirm-desc").textContent).toContain("revert to the previous");
    await act(async () => fireEvent.click(screen.getByTestId("confirm-btn")));
    expect(mutationMap.get("config/rollback")!.mutateAsync).toHaveBeenCalled();
  });

  it("closes the confirm dialog via cancel", () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Confirm"));
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("fires onSuccess for all mutations", () => {
    loaded();
    render(<ConfigPage />);
    mutationMap.get("config/apply")!.onSuccess!();
    mutationMap.get("config/confirm")!.onSuccess!();
    mutationMap.get("config/rollback")!.onSuccess!();
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows Saving… while apply is pending", () => {
    pending = true;
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Saving…")).toBeTruthy();
  });

  it("disables Edit when config is not loaded", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: undefined });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    expect((screen.getByText("Edit").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits with fallbacks when content/path missing", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config") return mockQuery({ data: {} });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    expect((screen.getByLabelText("Configuration content") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("config")).toBeTruthy();
  });

  it("refreshes revisions and shows empty states", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config")
        return mockQuery({ data: { path: "/x", content: "", last_modified: "" } });
      return mockQuery({ data: [], refetch });
    });
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByText("No configuration backups available.")).toBeTruthy();
    expect(screen.getByText("No configuration revisions.")).toBeTruthy();
  });

  it("renders backup size dash when size is absent", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config")
        return mockQuery({ data: { path: "/x", content: "x", last_modified: "" } });
      if (path === "config/backups") return mockQuery({ data: [{ name: "b", created: "d" }] });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders revision size dash when size is absent", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "config")
        return mockQuery({ data: { path: "/x", content: "x", last_modified: "" } });
      if (path === "config/revisions") return mockQuery({ data: [{ name: "r", created: "d" }] });
      return mockQuery({ data: [] });
    });
    render(<ConfigPage />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ConfigPage server validation", () => {
  it("runs server-side validation and shows success result", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    // Mock validate mutation to return valid result via mutateAsync
    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({ valid: true, issues: [] });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(
      mutationMap.get("config/validate")!.mutateAsync,
    ).toHaveBeenCalledWith({ content: "[ppp]\nverbose=1" });
    expect(toast.success).toHaveBeenCalledWith("Server validation passed");
    expect(screen.getByText("Server validation passed")).toBeTruthy();
  });

  it("runs server-side validation and shows issues", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({
        valid: false,
        issues: [
          { line: 5, level: "error", message: "Unknown section" },
          { line: 10, level: "warning", message: "Deprecated option" },
        ],
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(toast.error).toHaveBeenCalledWith("2 issues found");
    expect(screen.getByText("2 issues found")).toBeTruthy();
    expect(screen.getByText("L5")).toBeTruthy();
    expect(screen.getByText("[error]")).toBeTruthy();
    expect(screen.getByText("Unknown section")).toBeTruthy();
    expect(screen.getByText("L10")).toBeTruthy();
    expect(screen.getByText("[warning]")).toBeTruthy();
    expect(screen.getByText("Deprecated option")).toBeTruthy();
  });

  it("handles single validation issue (no plural 's')", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({
        valid: false,
        issues: [{ message: "Bad config" }],
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(toast.error).toHaveBeenCalledWith("1 issue found");
    // Issue without line or level uses fallbacks
    expect(screen.getByText("[warning]")).toBeTruthy();
    expect(screen.getByText("Bad config")).toBeTruthy();
  });

  it("shows error result with error field", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({
        valid: false,
        error: "Config file not found",
        issues: [],
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(screen.getByText("Config file not found")).toBeTruthy();
  });

  it("handles validation request failure", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("network"));

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(toast.error).toHaveBeenCalledWith("Validation request failed");
  });

  it("shows Validating… while validate is pending", () => {
    pending = true;
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Validating…")).toBeTruthy();
  });

  it("fires validate onSuccess callback", () => {
    loaded();
    render(<ConfigPage />);
    mutationMap.get("config/validate")!.onSuccess!();
    // onSuccess is a no-op — result handled by runValidate
    expect(true).toBe(true);
  });

  it("handles validate result with no issues array", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({ valid: false });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(toast.error).toHaveBeenCalledWith("0 issues found");
  });

  it("renders issue without message as 'Unknown issue'", async () => {
    loaded();
    render(<ConfigPage />);
    fireEvent.click(screen.getByText("Edit"));

    mutationMap.get("config/validate")!.mutateAsync = vi
      .fn()
      .mockResolvedValue({
        valid: false,
        issues: [{ line: 1, level: "error" }],
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Validate (server)"));
    });

    expect(screen.getByText("Unknown issue")).toBeTruthy();
  });
});
