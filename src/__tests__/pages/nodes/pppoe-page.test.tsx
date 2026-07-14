/**
 * Dedicated tests for the PPPoE page.
 * Covers the read surface (loading / error+retry / empty / interface cards with
 * option chips + "default options" / MAC filter status parsing) AND the new
 * management surface: add-interface dialog (open / required validation / submit
 * success / error / pending / cancel), per-card interface delete (confirm +
 * success + error + cancel), MAC add (required / malformed / success / pending),
 * and MAC entry listing + delete when the node exposes entries.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

interface MutationOpts {
  method?: string;
  onSuccess?: () => void;
}

/** Default mutation mock — one captured object per (method:path), keyed so the
 *  POST add and DELETE remove of the same base path never collide. */
function defaultMutationImpl(_nid: string, path: string, opts?: MutationOpts) {
  const key = `${_nid}:${opts?.method ?? "POST"}:${path}`;
  if (!mutationMap.has(key)) {
    mutationMap.set(key, {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
      onSuccess: opts?.onSuccess,
    });
  }
  const existing = mutationMap.get(key)!;
  existing.onSuccess = opts?.onSuccess;
  return existing;
}

import PppoePage from "@/app/(dashboard)/nodes/[nodeId]/pppoe/page";

/** Interfaces + MAC filter happy-path query mock, with optional overrides. */
function withData(
  interfaces: unknown,
  macRaw: unknown,
  extra: (path: string) => ReturnType<typeof mockQuery> | undefined = () =>
    undefined,
) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "pppoe/interfaces") return mockQuery({ data: interfaces });
    if (path === "pppoe/mac-filter") {
      return mockQuery({ data: { raw_output: macRaw, count: 0 } });
    }
    return extra(path) ?? mockQuery();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(defaultMutationImpl);
});

describe("PppoePage", () => {
  it("shows loading state", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<PppoePage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders interface cards with option chips, delete controls, and MAC status", () => {
    withData(
      [
        { name: "ens19", options: "mtu 1492 mru 1492 start-session" },
        { name: "ens20", options: "" },
      ],
      "filter type: disabled",
    );
    render(<PppoePage />);

    expect(screen.getByText("PPPoE Interfaces (2)")).toBeTruthy();
    expect(screen.getByText("ens19")).toBeTruthy();
    expect(screen.getByText("ens20")).toBeTruthy();

    // Option string split into chips.
    expect(screen.getByText("mtu")).toBeTruthy();
    expect(screen.getByText("mru")).toBeTruthy();
    expect(screen.getByText("start-session")).toBeTruthy();
    expect(screen.getAllByText("1492").length).toBe(2);

    // Interface with empty options shows the fallback, not chips.
    expect(screen.getByText("default options")).toBeTruthy();

    // Per-card delete controls are present.
    expect(
      screen.getByRole("button", { name: "Delete interface ens19" }),
    ).toBeTruthy();

    // MAC filter parsed to "disabled" with a non-enabled (secondary) badge.
    const macBadge = screen.getByText("disabled");
    expect(macBadge.getAttribute("data-variant")).toBe("secondary");
  });

  it("renders MAC filter enabled status from a colon-less raw_output", () => {
    withData([{ name: "ens19", options: "" }], "enabled");
    render(<PppoePage />);
    const macBadge = screen.getByText("enabled");
    expect(macBadge.getAttribute("data-variant")).toBe("default");
  });

  it("shows the interfaces empty note, Unknown MAC status, and add controls", () => {
    withData([], "");
    render(<PppoePage />);
    expect(screen.getByText("No PPPoE interfaces configured.")).toBeTruthy();
    // No status reported → Unknown badge, still offering the Add MAC control.
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.getByText(/reports only the filter/)).toBeTruthy();
    expect(screen.getByText("Add MAC")).toBeTruthy();
  });

  it("retries both sections on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("Network error"), refetch }),
    );
    render(<PppoePage />);
    const retryButtons = screen.getAllByText("Retry");
    expect(retryButtons.length).toBe(2);
    retryButtons.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes the interfaces section", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "pppoe/interfaces") {
        return mockQuery({ data: [{ name: "ens19", options: "" }], refetch });
      }
      return mockQuery({ data: { raw_output: "filter type: disabled" } });
    });
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // ---- Add interface --------------------------------------------------------

  it("opens the add-interface dialog and requires an interface name", () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Add Interface"));
    expect(screen.getByText("Add PPPoE Interface")).toBeTruthy();

    // Submit with an empty name → inline required error, no mutation.
    const form = screen.getAllByText("Add Interface")[1].closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByText("Interface name is required.")).toBeTruthy();
    expect(
      mutationMap.get("n1:POST:pppoe/interfaces")!.mutateAsync,
    ).not.toHaveBeenCalled();
  });

  it("adds an interface (name + optional options) and closes the dialog", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Add Interface"));
    fireEvent.change(screen.getByPlaceholderText("ens19"), {
      target: { value: "ens21" },
    });
    fireEvent.change(screen.getByPlaceholderText("mtu 1492 mru 1492"), {
      target: { value: "mtu 1400" },
    });
    fireEvent.submit(screen.getAllByText("Add Interface")[1].closest("form")!);

    expect(
      mutationMap.get("n1:POST:pppoe/interfaces")!.mutateAsync,
    ).toHaveBeenCalledWith({ interface: "ens21", options: "mtu 1400" });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Interface ens21 added"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Add PPPoE Interface")).toBeNull(),
    );
  });

  it("surfaces an add-interface error (Error branch)", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    mutationMap.get("n1:POST:pppoe/interfaces")!.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("interface already exists"));
    fireEvent.click(screen.getByText("Add Interface"));
    fireEvent.change(screen.getByPlaceholderText("ens19"), {
      target: { value: "ens21" },
    });
    fireEvent.submit(screen.getAllByText("Add Interface")[1].closest("form")!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Add failed", {
        description: "interface already exists",
      }),
    );
    // Error surfaced inline; dialog stays open for correction.
    expect(screen.getByText("interface already exists")).toBeTruthy();
  });

  it("disables the add-interface dialog while its mutation is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, path: string, opts?: MutationOpts) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: path === "pppoe/interfaces" && opts?.method !== "DELETE",
        onSuccess: opts?.onSuccess,
      }),
    );
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Add Interface"));
    const submit = screen.getAllByText("Add Interface")[1].closest("button");
    expect(submit?.disabled).toBe(true);
  });

  it("closes the add-interface dialog on cancel", () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Add Interface"));
    expect(screen.getByText("Add PPPoE Interface")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add PPPoE Interface")).toBeNull();
  });

  // ---- Add MAC --------------------------------------------------------------

  it("requires a MAC address before adding", () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.submit(screen.getByText("Add MAC").closest("form")!);
    expect(screen.getByText("MAC address is required.")).toBeTruthy();
    expect(
      mutationMap.get("n1:POST:pppoe/mac-filter")!.mutateAsync,
    ).not.toHaveBeenCalled();
  });

  it("rejects a malformed MAC address client-side", () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.change(screen.getByPlaceholderText("00:11:22:33:44:55"), {
      target: { value: "not-a-mac" },
    });
    fireEvent.submit(screen.getByText("Add MAC").closest("form")!);
    expect(
      screen.getByText("Enter a valid MAC address, e.g. 00:11:22:33:44:55."),
    ).toBeTruthy();
    expect(
      mutationMap.get("n1:POST:pppoe/mac-filter")!.mutateAsync,
    ).not.toHaveBeenCalled();
  });

  it("adds a valid MAC address (non-Error rejection fallback covered elsewhere)", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.change(screen.getByPlaceholderText("00:11:22:33:44:55"), {
      target: { value: "00:11:22:33:44:55" },
    });
    fireEvent.submit(screen.getByText("Add MAC").closest("form")!);
    expect(
      mutationMap.get("n1:POST:pppoe/mac-filter")!.mutateAsync,
    ).toHaveBeenCalledWith({ mac: "00:11:22:33:44:55" });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "MAC 00:11:22:33:44:55 added to filter",
      ),
    );
  });

  it("surfaces an add-MAC error with the fallback message (non-Error branch)", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    // Reject with a non-Error value → falls back to the default message.
    mutationMap.get("n1:POST:pppoe/mac-filter")!.mutateAsync = vi
      .fn()
      .mockRejectedValue("boom");
    fireEvent.change(screen.getByPlaceholderText("00:11:22:33:44:55"), {
      target: { value: "00:11:22:33:44:55" },
    });
    fireEvent.submit(screen.getByText("Add MAC").closest("form")!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Add failed", {
        description: "Failed to add MAC address.",
      }),
    );
    expect(screen.getByText("Failed to add MAC address.")).toBeTruthy();
  });

  it("disables the Add MAC button while its mutation is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, path: string, opts?: MutationOpts) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: path === "pppoe/mac-filter",
        onSuccess: opts?.onSuccess,
      }),
    );
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    expect(screen.getByText("Add MAC").closest("button")?.disabled).toBe(true);
  });

  // ---- Delete flows ---------------------------------------------------------

  it("deletes an interface after confirmation", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete interface ens19" }),
    );
    expect(screen.getByText("Delete PPPoE interface?")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete"));

    const del = mutationMap.get("n1:DELETE:pppoe/interfaces/ens19")!;
    expect(del.mutateAsync).toHaveBeenCalledWith(undefined);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Interface ens19 removed"),
    );
  });

  it("surfaces a delete error and keeps the confirm dialog open", async () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete interface ens19" }),
    );
    mutationMap.get("n1:DELETE:pppoe/interfaces/ens19")!.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("interface busy"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Delete failed", {
        description: "interface busy",
      }),
    );
    expect(screen.getByText("Delete PPPoE interface?")).toBeTruthy();
  });

  it("closes the delete confirmation on cancel", () => {
    withData([{ name: "ens19", options: "" }], "filter type: disabled");
    render(<PppoePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete interface ens19" }),
    );
    expect(screen.getByText("Delete PPPoE interface?")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete PPPoE interface?")).toBeNull();
  });

  it("lists MAC entries exposed in raw_output and removes one", async () => {
    withData([], "filter type: enabled\n00:11:22:33:44:55\nAA-BB-CC-DD-EE-FF");
    render(<PppoePage />);

    // Status parsed from the first line; MAC lines listed as removable entries.
    expect(screen.getByText("enabled").getAttribute("data-variant")).toBe(
      "default",
    );
    expect(screen.getByText("00:11:22:33:44:55")).toBeTruthy();
    expect(screen.getByText("AA-BB-CC-DD-EE-FF")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove MAC 00:11:22:33:44:55" }),
    );
    expect(screen.getByText("Remove MAC entry?")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete"));

    const del = mutationMap.get(
      "n1:DELETE:pppoe/mac-filter/00%3A11%3A22%3A33%3A44%3A55",
    )!;
    expect(del.mutateAsync).toHaveBeenCalledWith(undefined);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "MAC 00:11:22:33:44:55 removed from filter",
      ),
    );
  });
});

describe("PppoePage runtime config", () => {
  it("shows loading state for runtime section", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime" ? mockQuery({ isLoading: true }) : undefined,
    );
    render(<PppoePage />);
    expect(screen.getByText("PPPoE Runtime Config")).toBeTruthy();
  });

  it("shows unavailable badge on runtime error", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({ error: new Error("runtime down") })
        : undefined,
    );
    render(<PppoePage />);
    expect(screen.getByText("unavailable")).toBeTruthy();
  });

  it("renders runtime data as key-value pairs, filtering raw_output", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({
            data: {
              service_name: "internet",
              ac_name: "dawos-dev",
              verbose: 1,
              raw_output: "should be hidden",
            },
          })
        : undefined,
    );
    render(<PppoePage />);
    expect(screen.getByText("service name")).toBeTruthy();
    expect(screen.getByText("internet")).toBeTruthy();
    expect(screen.getByText("ac name")).toBeTruthy();
    expect(screen.getByText("dawos-dev")).toBeTruthy();
    expect(screen.queryByText("should be hidden")).toBeNull();
  });

  it("shows 'No runtime data' when runtime data is null", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime" ? mockQuery({ data: null }) : undefined,
    );
    render(<PppoePage />);
    expect(screen.getByText("No runtime data")).toBeTruthy();
  });

  it("renders em-dash for null runtime config values", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({
            data: {
              service_name: null,
              ac_name: "dawos-dev",
            },
          })
        : undefined,
    );
    render(<PppoePage />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("dawos-dev")).toBeTruthy();
  });

  it("applies runtime settings with all fields filled", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({ data: { service_name: "internet" } })
        : undefined,
    );
    render(<PppoePage />);

    fireEvent.change(screen.getByLabelText("Service Name"), {
      target: { value: "myisp" },
    });
    fireEvent.change(screen.getByLabelText("AC Name"), {
      target: { value: "bng-1" },
    });
    fireEvent.change(screen.getByLabelText("Verbose"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByText("Apply Runtime Settings"));

    const m = mutationMap.get("n1:POST:pppoe/runtime-set")!;
    expect(m.mutate).toHaveBeenCalledWith({
      service_name: "myisp",
      ac_name: "bng-1",
      verbose: 2,
    });
  });

  it("shows toast error when no fields are filled", () => {
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({ data: { service_name: "internet" } })
        : undefined,
    );
    render(<PppoePage />);
    fireEvent.click(screen.getByText("Apply Runtime Settings"));
    expect(toast.error).toHaveBeenCalledWith(
      "Provide at least one field to update",
    );
  });

  it("fires onSuccess toast for runtime-set mutation", () => {
    withData([], "filter type: disabled");
    render(<PppoePage />);
    const m = mutationMap.get("n1:POST:pppoe/runtime-set")!;
    m.onSuccess!();
    expect(toast.success).toHaveBeenCalledWith(
      "PPPoE runtime settings updated",
    );
  });

  it("disables inputs while runtime-set is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, path: string, opts?: MutationOpts) => {
        void `${_nid}:${opts?.method ?? "POST"}`;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: path === "pppoe/runtime-set",
          onSuccess: opts?.onSuccess,
        };
      },
    );
    withData([], "filter type: disabled", (path) =>
      path === "pppoe/runtime"
        ? mockQuery({ data: { service_name: "internet" } })
        : undefined,
    );
    render(<PppoePage />);
    const serviceInput = screen.getByLabelText("Service Name") as HTMLInputElement;
    expect(serviceInput.disabled).toBe(true);
    const applyBtn = screen.getByText("Apply Runtime Settings").closest("button");
    expect(applyBtn?.disabled).toBe(true);
  });
});
