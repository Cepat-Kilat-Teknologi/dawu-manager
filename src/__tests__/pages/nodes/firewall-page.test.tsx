/**
 * Dedicated tests for the redesigned Firewall page.
 * Covers: loading / error+retry / empty rules & sysctl; the filterable code
 * viewer (highlight, filtered count, no-match note, regex-special terms);
 * sysctl parsing (true/false/other/no-colon/empty segments); the Save Rules
 * mutation (fire / onSuccess / pending); and the graceful optional-feature
 * tiles (available data, 404/405 unavailable, non-unavailable errors, null).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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

// ConfirmDialog: render a clickable confirm button when open.
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

import { ProxyError } from "@/hooks/use-node-proxy";
import FirewallPage from "@/app/(dashboard)/nodes/[nodeId]/firewall/page";

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

const RAW = [
  "table ip accelnat {",
  "  chain postrouting {",
  "    ip saddr 10.0.0.0/24 masquerade",
  "  }",
  "}",
  "table inet filter {",
  "  chain input {",
  "    tcp dport 22 accept",
  "    tcp dport 80 drop",
  "  }",
  "}",
].join("\n");

// Production shape: the agent returns `status` as an OBJECT.
const SYSCTL_OBJ = { ip_forward: true, ip6_forward: false, rp_filter: 1 };
// Legacy shape: older agents returned a string (still parsed defensively).
const SYSCTL_STATUS = "ip_forward: true, ip6_forward: false, rp_filter: 1, orphan, ";

/** Full production-like happy-path mock: rules + object-shaped sysctl present. */
function withRulesAndSysctl(
  extra: (path: string) => ReturnType<typeof mockQuery> | undefined,
) {
  mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
    if (path === "firewall/rules") {
      return mockQuery({ data: { raw_output: RAW, rules_count: 86 } });
    }
    if (path === "firewall/sysctl") {
      return mockQuery({ data: { status: SYSCTL_OBJ } });
    }
    return extra(path) ?? mockQuery();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMap.clear();
  mockUseNodeProxy.mockReturnValue(mockQuery());
  mockUseNodeProxyMutation.mockImplementation(
    (
      _nid: string,
      path: string,
      opts?: { method?: string; onSuccess?: () => void },
    ) => {
      // Include explicit HTTP method in the key so POST and DELETE mutations
      // sharing the same path (e.g. firewall/nat/masquerade) get distinct entries.
      const key = opts?.method
        ? `${_nid}:${opts.method}:${path}`
        : `${_nid}:${path}`;
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
    },
  );
});

describe("FirewallPage", () => {
  it("shows loading state (and optional tiles show 'Checking')", () => {
    mockUseNodeProxy.mockReturnValue(mockQuery({ isLoading: true }));
    render(<FirewallPage />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Checking").length).toBe(4);
  });

  it("renders rules, sysctl, and marks optional endpoints unavailable (404/405)", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({ error: new ProxyError("not found", 404) });
      }
      if (path === "firewall/nat/masquerade") {
        return mockQuery({ error: new ProxyError("method not allowed", 405) });
      }
      if (path === "firewall/conntrack/config") {
        return mockQuery({ error: new ProxyError("not found", 404) });
      }
      if (path === "firewall/groups") {
        return mockQuery({ error: new ProxyError("not found", 404) });
      }
      return undefined;
    });
    render(<FirewallPage />);

    // rules_count badge + full unfiltered ruleset.
    expect(screen.getByText("86 rules")).toBeTruthy();
    expect(screen.getByText(/dport 22 accept/)).toBeTruthy();
    expect(screen.getByText(/dport 80 drop/)).toBeTruthy();
    expect(screen.getByText(/masquerade/)).toBeTruthy();

    // object-shaped sysctl parsed into rows with typed value badges.
    expect(screen.getByText("ip_forward")).toBeTruthy();
    expect(screen.getByText("ip6_forward")).toBeTruthy();
    expect(screen.getByText("rp_filter")).toBeTruthy();
    expect(screen.getByText("true")).toBeTruthy();
    expect(screen.getByText("false")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();

    // All four optional features gracefully unavailable (no scary error card).
    expect(screen.getAllByText("Not available on this node").length).toBe(4);
    // Titles appear both in the OptionalFeature tile and the management Card.
    expect(screen.getAllByText("NAT Egress").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("NAT Masquerade").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Conntrack")).toBeTruthy();
    expect(
      screen.getAllByText("Firewall Groups").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("parses a legacy string-shaped sysctl status", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: RAW, rules_count: 86 } });
      }
      if (path === "firewall/sysctl") {
        return mockQuery({ data: { status: SYSCTL_STATUS } });
      }
      return mockQuery();
    });
    render(<FirewallPage />);
    // no-colon segment becomes a bare key; trailing empty segment is dropped.
    expect(screen.getByText("ip_forward")).toBeTruthy();
    expect(screen.getByText("orphan")).toBeTruthy();
  });

  it("ignores a non-string, non-object sysctl status", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: RAW, rules_count: 86 } });
      }
      if (path === "firewall/sysctl") {
        return mockQuery({ data: { status: 42 } });
      }
      return mockQuery();
    });
    render(<FirewallPage />);
    expect(
      screen.getByText("No network sysctl values reported."),
    ).toBeTruthy();
  });

  it("filters ruleset lines with highlight and a filtered count", () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    const input = screen.getByPlaceholderText(
      "Filter rules (dport, accept, snat)...",
    );
    fireEvent.change(input, { target: { value: "accept" } });

    // Matching line remains (with a <mark>), non-matching line is gone.
    expect(screen.getByText("accept")).toBeTruthy();
    expect(screen.queryByText(/dport 80 drop/)).toBeNull();
    expect(screen.getByText("1 of 11 lines")).toBeTruthy();
  });

  it("shows a no-match note when the filter matches nothing", () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    const input = screen.getByPlaceholderText(
      "Filter rules (dport, accept, snat)...",
    );
    fireEvent.change(input, { target: { value: "zzzznomatch" } });
    expect(screen.getByText(/No lines match/)).toBeTruthy();
  });

  it("filters safely with a regex-special term", () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    const input = screen.getByPlaceholderText(
      "Filter rules (dport, accept, snat)...",
    );
    fireEvent.change(input, { target: { value: "10.0.0.0/24" } });
    // Dots/slash are escaped — the masquerade line matches, nothing throws.
    expect(screen.getByText("10.0.0.0/24")).toBeTruthy();
    expect(screen.getByText("1 of 11 lines")).toBeTruthy();
  });

  it("renders optional features when the node supports them", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({ data: [{ type: "snat" }, { type: "snat" }] });
      }
      if (path === "firewall/nat/masquerade") {
        return mockQuery({ data: [] });
      }
      if (path === "firewall/conntrack/config") {
        return mockQuery({ data: { max_entries: 65536 } });
      }
      if (path === "firewall/groups") {
        return mockQuery({ data: [{ name: "blocked" }] });
      }
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.getByText("2 rules")).toBeTruthy();
    expect(screen.getByText("0 rules")).toBeTruthy();
    expect(screen.getByText("Configured")).toBeTruthy();
    expect(screen.getByText("1 groups")).toBeTruthy();
  });

  it("handles loading, non-unavailable errors, and null optional data", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({ isLoading: true });
      }
      if (path === "firewall/nat/masquerade") {
        return mockQuery({ error: new ProxyError("boom", 500) });
      }
      if (path === "firewall/conntrack/config") {
        return mockQuery({ error: new Error("plain failure") });
      }
      if (path === "firewall/groups") {
        return mockQuery({ data: null });
      }
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.getByText("Checking")).toBeTruthy();
    // ProxyError 500 + a plain Error both render as a non-fatal "Error" badge.
    expect(screen.getAllByText("Error").length).toBe(2);
    // Null data (no error) is treated as unavailable, not a crash.
    expect(screen.getByText("Not available on this node")).toBeTruthy();
  });

  it("saves rules after confirmation and invokes its onSuccess", async () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    fireEvent.click(screen.getByText("Save Rules"));
    // Saving the ruleset is now gated behind an impact-explicit confirmation.
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "persists the live nftables ruleset",
    );
    const save = mutationMap.get("n1:firewall/save")!;
    await act(async () => fireEvent.click(screen.getByTestId("confirm-btn")));
    expect(save.mutateAsync).toHaveBeenCalledWith({});
    save.onSuccess!();
  });

  it("closes the save confirmation on cancel without saving", () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    fireEvent.click(screen.getByText("Save Rules"));
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    expect(mutationMap.get("n1:firewall/save")!.mutateAsync).not.toHaveBeenCalled();
  });

  it("disables Save Rules while the mutation is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, path: string, opts?: { onSuccess?: () => void }) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: path === "firewall/save",
        onSuccess: opts?.onSuccess,
      }),
    );
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    const saveBtn = screen.getByText("Save Rules").closest("button");
    expect(saveBtn?.disabled).toBe(true);
  });

  it("refreshes the rules section", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({
          data: { raw_output: RAW, rules_count: 86 },
          refetch,
        });
      }
      if (path === "firewall/sysctl") {
        return mockQuery({ data: { status: SYSCTL_STATUS } });
      }
      return mockQuery();
    });
    render(<FirewallPage />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the empty rules state", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: "", rules_count: 0 } });
      }
      return mockQuery({ data: { status: SYSCTL_STATUS } });
    });
    render(<FirewallPage />);
    expect(screen.getByText("No firewall rules configured.")).toBeTruthy();
  });

  it("renders the empty sysctl state when no status is reported", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: RAW, rules_count: 86 } });
      }
      if (path === "firewall/sysctl") {
        return mockQuery({ data: { success: true } });
      }
      return mockQuery();
    });
    render(<FirewallPage />);
    expect(screen.getByText("No network sysctl values reported.")).toBeTruthy();
  });

  it("falls back to '0 rules' when rules_count is missing", () => {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: "table x {}" } });
      }
      return mockQuery({ data: { status: SYSCTL_STATUS } });
    });
    render(<FirewallPage />);
    expect(screen.getByText("0 rules")).toBeTruthy();
  });

  it("retries the rules and sysctl sections on error", () => {
    const refetch = vi.fn();
    mockUseNodeProxy.mockReturnValue(
      mockQuery({ error: new Error("Network error"), refetch }),
    );
    render(<FirewallPage />);
    const retryButtons = screen.getAllByText("Retry");
    expect(retryButtons.length).toBe(2);
    retryButtons.forEach((btn) => fireEvent.click(btn));
    expect(refetch).toHaveBeenCalledTimes(2);
    // Optional features with a plain Error render the non-fatal "Error" badge.
    expect(screen.getAllByText("Error").length).toBe(4);
  });

  // ---- Validate ruleset -----------------------------------------------------

  it("shows the validate-before-save hint and validates the ruleset", async () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    // The nudge encourages validating before saving.
    expect(
      screen.getByText(
        "Tip: click Validate to check the ruleset before saving.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Validate"));
    const validate = mutationMap.get("n1:firewall/validate")!;
    // firewall/validate takes an empty body.
    expect(validate.mutateAsync).toHaveBeenCalledWith({});
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Ruleset valid"),
    );
    // Hint flips to the "safe to save" state.
    await waitFor(() =>
      expect(
        screen.getByText("Ruleset validated — safe to save."),
      ).toBeTruthy(),
    );
  });

  it("surfaces a validation error message (Error branch)", async () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    mutationMap.get("n1:firewall/validate")!.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ProxyError("chain input: syntax error", 400));
    fireEvent.click(screen.getByText("Validate"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Validation failed", {
        description: "chain input: syntax error",
      }),
    );
    // Hint remains in the un-validated state.
    expect(
      screen.getByText(
        "Tip: click Validate to check the ruleset before saving.",
      ),
    ).toBeTruthy();
  });

  it("surfaces a validation error with the fallback message (non-Error branch)", async () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    mutationMap.get("n1:firewall/validate")!.mutateAsync = vi
      .fn()
      .mockRejectedValue("boom");
    fireEvent.click(screen.getByText("Validate"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Validation failed", {
        description: "Ruleset validation failed.",
      }),
    );
  });

  it("disables Validate while its mutation is pending", () => {
    mockUseNodeProxyMutation.mockImplementation(
      (_nid: string, path: string, opts?: { onSuccess?: () => void }) => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: path === "firewall/validate",
        onSuccess: opts?.onSuccess,
      }),
    );
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    expect(screen.getByText("Validate").closest("button")?.disabled).toBe(true);
  });

  it("resets the validated hint after a successful save", async () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    fireEvent.click(screen.getByText("Validate"));
    await waitFor(() =>
      expect(
        screen.getByText("Ruleset validated — safe to save."),
      ).toBeTruthy(),
    );
    // Saving invalidates the prior validation; the nudge returns.
    mutationMap.get("n1:firewall/save")!.onSuccess!();
    await waitFor(() =>
      expect(
        screen.getByText(
          "Tip: click Validate to check the ruleset before saving.",
        ),
      ).toBeTruthy(),
    );
  });

  // ===========================================================================
  // Group 3 — Advanced Firewall Management
  // ===========================================================================

  /** Set up all optional features with happy-path data. */
  function withAllFeatures() {
    mockUseNodeProxy.mockImplementation((_nid: string, path: string) => {
      if (path === "firewall/rules") {
        return mockQuery({ data: { raw_output: RAW, rules_count: 86 } });
      }
      if (path === "firewall/sysctl") {
        return mockQuery({ data: { status: SYSCTL_OBJ } });
      }
      if (path === "firewall/nat/egress") {
        return mockQuery({
          data: [
            { target: "10.0.0.1", public_ip: "203.0.113.1" },
            { target: "10.0.0.2", public_ip: "203.0.113.2" },
          ],
        });
      }
      if (path === "firewall/nat/masquerade") {
        return mockQuery({ data: [{ interface: "eth0" }] });
      }
      if (path === "firewall/conntrack/config") {
        return mockQuery({
          data: { max_entries: 65536, tcp_timeout: 3600 },
        });
      }
      if (path === "firewall/groups") {
        return mockQuery({
          data: [
            { name: "blocked-ips", type: "address" },
            { name: "server-ports", group_type: "port" },
          ],
        });
      }
      return mockQuery();
    });
  }

  /** Find the ghost (icon-only delete) button nearest to text content. */
  function findDeleteButton(text: string): HTMLElement {
    const el = screen.getByText(new RegExp(text.replace(/\./g, "\\.")));
    const row = el.closest("div")!;
    const btn = row.querySelector("button");
    if (!btn) throw new Error(`No button found near "${text}"`);
    return btn;
  }

  // ---- Sysctl update --------------------------------------------------------

  describe("sysctl update form", () => {
    it("renders the forwarding tip and checkboxes", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(
        screen.getByText(
          "Toggle IPv4/IPv6 forwarding. Changes take effect immediately.",
        ),
      ).toBeTruthy();
      expect(screen.getByLabelText("IPv4 Forwarding")).toBeTruthy();
      expect(screen.getByLabelText("IPv6 Forwarding")).toBeTruthy();
    });

    it("fires sysctl mutation with the checkbox values", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      // Default: IPv4 checked, IPv6 unchecked. Toggle IPv6 on.
      fireEvent.click(screen.getByLabelText("IPv6 Forwarding"));
      fireEvent.click(screen.getByText("Update Sysctls"));
      const m = mutationMap.get("n1:PUT:firewall/sysctl")!;
      expect(m.mutate).toHaveBeenCalledWith({
        ip_forward: true,
        ip6_forward: true,
      });
    });

    it("toggles IPv4 off and fires mutation", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByLabelText("IPv4 Forwarding"));
      fireEvent.click(screen.getByText("Update Sysctls"));
      expect(
        mutationMap.get("n1:PUT:firewall/sysctl")!.mutate,
      ).toHaveBeenCalledWith({
        ip_forward: false,
        ip6_forward: false,
      });
    });

    it("shows toast on sysctl success", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      mutationMap.get("n1:PUT:firewall/sysctl")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Sysctl settings updated");
    });

    it("disables Update Sysctls while pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: path === "firewall/sysctl" && opts?.method === "PUT",
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(
        screen.getByText("Update Sysctls").closest("button")?.disabled,
      ).toBe(true);
    });
  });

  // ---- NAT Egress -----------------------------------------------------------

  describe("NAT Egress management", () => {
    it("displays egress entries with target → public_ip", () => {
      withAllFeatures();
      render(<FirewallPage />);
      expect(screen.getByText(/10\.0\.0\.1/)).toBeTruthy();
      expect(screen.getByText(/203\.0\.113\.1/)).toBeTruthy();
      expect(screen.getByText(/10\.0\.0\.2/)).toBeTruthy();
      expect(screen.getByText(/203\.0\.113\.2/)).toBeTruthy();
    });

    it("shows 'No egress rules.' when data is empty", () => {
      withRulesAndSysctl((path) => {
        if (path === "firewall/nat/egress") return mockQuery({ data: [] });
        return undefined;
      });
      render(<FirewallPage />);
      expect(screen.getByText("No egress rules.")).toBeTruthy();
    });

    it("validates empty fields on add", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByText("Add"));
      expect(toast.error).toHaveBeenCalledWith(
        "Both customer IP and public IP are required",
      );
    });

    it("validates when only customer IP is filled", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("10.0.0.1"), {
        target: { value: "10.0.0.5" },
      });
      fireEvent.click(screen.getByText("Add"));
      expect(toast.error).toHaveBeenCalledWith(
        "Both customer IP and public IP are required",
      );
    });

    it("fires add egress mutation with correct body", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("10.0.0.1"), {
        target: { value: "10.0.0.5" },
      });
      fireEvent.change(screen.getByPlaceholderText("203.0.113.10"), {
        target: { value: "203.0.113.99" },
      });
      fireEvent.click(screen.getByText("Add"));
      expect(
        mutationMap.get("n1:firewall/nat/egress")!.mutate,
      ).toHaveBeenCalledWith({
        target: "10.0.0.5",
        public_ip: "203.0.113.99",
      });
    });

    it("shows toast on add egress success", () => {
      withAllFeatures();
      render(<FirewallPage />);
      mutationMap.get("n1:firewall/nat/egress")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("NAT egress rule added");
    });

    it("opens delete confirm, fires mutation, and closes", async () => {
      withAllFeatures();
      render(<FirewallPage />);
      // Click the delete button on the first egress entry (10.0.0.1)
      const deleteBtn = findDeleteButton("10.0.0.1");
      fireEvent.click(deleteBtn);
      // ConfirmDialog should appear with impact description
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "10.0.0.1",
      );
      // Confirm deletion
      await act(async () =>
        fireEvent.click(screen.getByTestId("confirm-btn")),
      );
      const del = mutationMap.get("n1:DELETE:firewall/nat/egress/10.0.0.1")!;
      expect(del.mutateAsync).toHaveBeenCalledWith({});
    });

    it("cancels delete egress dialog without firing mutation", () => {
      withAllFeatures();
      render(<FirewallPage />);
      fireEvent.click(findDeleteButton("10.0.0.1"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows toast on delete egress success", () => {
      withAllFeatures();
      render(<FirewallPage />);
      // Trigger state so the DELETE path mutation is registered
      fireEvent.click(findDeleteButton("10.0.0.1"));
      mutationMap.get("n1:DELETE:firewall/nat/egress/10.0.0.1")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("NAT egress rule removed");
    });

    it("disables Add while pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending:
            path === "firewall/nat/egress" && opts?.method === undefined,
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(screen.getByText("Add").closest("button")?.disabled).toBe(true);
    });
  });

  // ---- NAT Masquerade -------------------------------------------------------

  describe("NAT Masquerade management", () => {
    it("validates empty interface on enable", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByText("Enable"));
      expect(toast.error).toHaveBeenCalledWith("WAN interface is required");
    });

    it("fires enable masquerade mutation with correct body", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("eth0"), {
        target: { value: "ens18" },
      });
      fireEvent.click(screen.getByText("Enable"));
      expect(
        mutationMap.get("n1:firewall/nat/masquerade")!.mutate,
      ).toHaveBeenCalledWith({ wan_interface: "ens18" });
    });

    it("shows toast on enable masquerade success", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      mutationMap.get("n1:firewall/nat/masquerade")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("NAT masquerade enabled");
    });

    it("opens disable confirm dialog and fires mutation", async () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByText("Disable"));
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "remove the masquerade rule",
      );
      await act(async () =>
        fireEvent.click(screen.getByTestId("confirm-btn")),
      );
      expect(
        mutationMap.get("n1:DELETE:firewall/nat/masquerade")!.mutateAsync,
      ).toHaveBeenCalledWith({});
    });

    it("cancels disable masquerade dialog", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByText("Disable"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows toast on disable masquerade success", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      mutationMap.get("n1:DELETE:firewall/nat/masquerade")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("NAT masquerade disabled");
    });

    it("disables Enable while pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending:
            path === "firewall/nat/masquerade" && opts?.method === undefined,
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(screen.getByText("Enable").closest("button")?.disabled).toBe(
        true,
      );
    });

    it("disables Disable while pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending:
            path === "firewall/nat/masquerade" && opts?.method === "DELETE",
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(screen.getByText("Disable").closest("button")?.disabled).toBe(
        true,
      );
    });
  });

  // ---- Conntrack tuning -----------------------------------------------------

  describe("Conntrack tuning management", () => {
    it("displays conntrack config data", () => {
      withAllFeatures();
      render(<FirewallPage />);
      expect(screen.getByText("max entries")).toBeTruthy();
      expect(screen.getByText("65536")).toBeTruthy();
      expect(screen.getByText("tcp timeout")).toBeTruthy();
      expect(screen.getByText("3600")).toBeTruthy();
    });

    it("validates empty conntrack max", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      // Click the Update button in the Conntrack card
      const conntrackCard = screen
        .getByText("Conntrack Tuning")
        .closest("[data-testid='card']")!;
      const updateBtn = within(conntrackCard as HTMLElement).getByText(
        "Update",
      );
      fireEvent.click(updateBtn);
      expect(toast.error).toHaveBeenCalledWith(
        "Conntrack max must be at least 16384",
      );
    });

    it("validates conntrack max below 16384", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("262144"), {
        target: { value: "1000" },
      });
      const conntrackCard = screen
        .getByText("Conntrack Tuning")
        .closest("[data-testid='card']")!;
      fireEvent.click(
        within(conntrackCard as HTMLElement).getByText("Update"),
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Conntrack max must be at least 16384",
      );
    });

    it("validates conntrack max with non-numeric input", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("262144"), {
        target: { value: "abc" },
      });
      const conntrackCard = screen
        .getByText("Conntrack Tuning")
        .closest("[data-testid='card']")!;
      fireEvent.click(
        within(conntrackCard as HTMLElement).getByText("Update"),
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Conntrack max must be at least 16384",
      );
    });

    it("fires conntrack mutation with correct body", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("262144"), {
        target: { value: "131072" },
      });
      const conntrackCard = screen
        .getByText("Conntrack Tuning")
        .closest("[data-testid='card']")!;
      fireEvent.click(
        within(conntrackCard as HTMLElement).getByText("Update"),
      );
      expect(
        mutationMap.get("n1:PUT:firewall/conntrack")!.mutate,
      ).toHaveBeenCalledWith({ max_value: 131072 });
    });

    it("shows toast on conntrack success", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      mutationMap.get("n1:PUT:firewall/conntrack")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Conntrack max updated");
    });

    it("disables Update while conntrack mutation is pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending:
            path === "firewall/conntrack" && opts?.method === "PUT",
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      const conntrackCard = screen
        .getByText("Conntrack Tuning")
        .closest("[data-testid='card']")!;
      expect(
        within(conntrackCard as HTMLElement)
          .getByText("Update")
          .closest("button")?.disabled,
      ).toBe(true);
    });
  });

  // ---- Firewall Groups ------------------------------------------------------

  describe("Firewall Groups management", () => {
    it("displays groups with name and type badge", () => {
      withAllFeatures();
      render(<FirewallPage />);
      expect(screen.getByText("blocked-ips")).toBeTruthy();
      // "address" also appears as <option> in the create form select
      expect(screen.getAllByText("address").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("server-ports")).toBeTruthy();
      // "port" also appears as <option>
      expect(screen.getAllByText("port").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'No firewall groups.' when data is empty", () => {
      withRulesAndSysctl((path) => {
        if (path === "firewall/groups") return mockQuery({ data: [] });
        return undefined;
      });
      render(<FirewallPage />);
      expect(screen.getByText("No firewall groups.")).toBeTruthy();
    });

    it("validates empty group name on create", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.click(screen.getByText("Create"));
      expect(toast.error).toHaveBeenCalledWith("Group name is required");
    });

    it("fires create group mutation with correct body", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("my-group"), {
        target: { value: "test-group" },
      });
      // Change type via native select
      fireEvent.change(screen.getByDisplayValue("address"), {
        target: { value: "port" },
      });
      fireEvent.change(
        screen.getByPlaceholderText("10.0.0.1, 10.0.0.2"),
        { target: { value: "80, 443, 8080" } },
      );
      fireEvent.click(screen.getByText("Create"));
      expect(
        mutationMap.get("n1:firewall/groups")!.mutate,
      ).toHaveBeenCalledWith({
        name: "test-group",
        group_type: "port",
        elements: ["80", "443", "8080"],
      });
    });

    it("creates group with empty elements list", () => {
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      fireEvent.change(screen.getByPlaceholderText("my-group"), {
        target: { value: "empty-group" },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(
        mutationMap.get("n1:firewall/groups")!.mutate,
      ).toHaveBeenCalledWith({
        name: "empty-group",
        group_type: "address",
        elements: [],
      });
    });

    it("shows toast on create group success", () => {
      withAllFeatures();
      render(<FirewallPage />);
      mutationMap.get("n1:firewall/groups")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Firewall group created");
    });

    it("opens delete confirm, fires mutation, and closes", async () => {
      withAllFeatures();
      render(<FirewallPage />);
      // Click delete button on "blocked-ips" group
      const deleteBtn = findDeleteButton("blocked-ips");
      fireEvent.click(deleteBtn);
      expect(screen.getByTestId("confirm-desc").textContent).toContain(
        "blocked-ips",
      );
      await act(async () =>
        fireEvent.click(screen.getByTestId("confirm-btn")),
      );
      const del = mutationMap.get(
        "n1:DELETE:firewall/groups/blocked-ips",
      )!;
      expect(del.mutateAsync).toHaveBeenCalledWith({});
    });

    it("cancels delete group dialog without firing mutation", () => {
      withAllFeatures();
      render(<FirewallPage />);
      fireEvent.click(findDeleteButton("blocked-ips"));
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      fireEvent.click(screen.getByTestId("cancel-btn"));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("shows toast on delete group success", () => {
      withAllFeatures();
      render(<FirewallPage />);
      fireEvent.click(findDeleteButton("blocked-ips"));
      mutationMap.get("n1:DELETE:firewall/groups/blocked-ips")!.onSuccess!();
      expect(toast.success).toHaveBeenCalledWith("Firewall group deleted");
    });

    it("disables Create while pending", () => {
      mockUseNodeProxyMutation.mockImplementation(
        (
          _nid: string,
          path: string,
          opts?: { method?: string; onSuccess?: () => void },
        ) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending:
            path === "firewall/groups" && opts?.method === undefined,
          onSuccess: opts?.onSuccess,
        }),
      );
      withRulesAndSysctl(() => undefined);
      render(<FirewallPage />);
      expect(screen.getByText("Create").closest("button")?.disabled).toBe(
        true,
      );
    });
  });

  // ---- Egress/groups empty fallback when unavailable or loading --------------

  it("hides egress and groups empty text when loading", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress")
        return mockQuery({ isLoading: true });
      if (path === "firewall/groups") return mockQuery({ isLoading: true });
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.queryByText("No egress rules.")).toBeNull();
    expect(screen.queryByText("No firewall groups.")).toBeNull();
  });

  it("hides egress and groups empty text when unavailable (404)", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress")
        return mockQuery({ error: new ProxyError("not found", 404) });
      if (path === "firewall/groups")
        return mockQuery({ error: new ProxyError("not found", 404) });
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.queryByText("No egress rules.")).toBeNull();
    expect(screen.queryByText("No firewall groups.")).toBeNull();
  });

  // ---- Entry with customer_ip fallback field --------------------------------

  it("renders egress entry using customer_ip fallback field", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({
          data: [{ customer_ip: "192.168.1.1", public_ip: "1.2.3.4" }],
        });
      }
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.getByText(/192\.168\.1\.1/)).toBeTruthy();
    expect(screen.getByText(/1\.2\.3\.4/)).toBeTruthy();
  });

  // ---- Groups with group_type fallback field --------------------------------

  it("renders group using group_type fallback field", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/groups") {
        return mockQuery({
          data: [{ name: "test-grp", group_type: "network" }],
        });
      }
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.getByText("test-grp")).toBeTruthy();
    // "network" also appears as <option> in the create form select
    expect(screen.getAllByText("network").length).toBeGreaterThanOrEqual(1);
  });

  // ---- Edge cases: entries with missing fields ------------------------------

  it("renders egress entry gracefully when both target and customer_ip are missing", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({
          data: [{ public_ip: "5.6.7.8" }],
        });
      }
      return undefined;
    });
    render(<FirewallPage />);
    expect(screen.getByText(/5\.6\.7\.8/)).toBeTruthy();
    // Click the delete button to exercise the onClick fallback branch (line 643)
    const deleteBtn = findDeleteButton("5.6.7.8");
    fireEvent.click(deleteBtn);
  });

  it("exercises delete onClick with customer_ip fallback", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/nat/egress") {
        return mockQuery({
          data: [{ customer_ip: "192.168.1.1", public_ip: "1.2.3.4" }],
        });
      }
      return undefined;
    });
    render(<FirewallPage />);
    const deleteBtn = findDeleteButton("192.168.1.1");
    fireEvent.click(deleteBtn);
    expect(screen.getByTestId("confirm-desc").textContent).toContain(
      "192.168.1.1",
    );
  });

  it("renders group gracefully when name is missing", () => {
    withRulesAndSysctl((path) => {
      if (path === "firewall/groups") {
        return mockQuery({
          data: [{ type: "address" }],
        });
      }
      return undefined;
    });
    render(<FirewallPage />);
    // Group renders without crashing; the delete button still works
    // "Firewall Groups" appears in both tile and card — pick the card title
    const allFG = screen.getAllByText("Firewall Groups");
    const groupsCard = allFG[allFG.length - 1].closest("[data-testid='card']")!;
    const deleteBtn = (groupsCard as HTMLElement).querySelector("button");
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
  });
});
