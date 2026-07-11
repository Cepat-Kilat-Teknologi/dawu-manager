/**
 * Dedicated tests for the redesigned Firewall page.
 * Covers: loading / error+retry / empty rules & sysctl; the filterable code
 * viewer (highlight, filtered count, no-match note, regex-special terms);
 * sysctl parsing (true/false/other/no-colon/empty segments); the Save Rules
 * mutation (fire / onSuccess / pending); and the graceful optional-feature
 * tiles (available data, 404/405 unavailable, non-unavailable errors, null).
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
    (_nid: string, path: string, opts?: { onSuccess?: () => void }) => {
      const key = `${_nid}:${path}`;
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
    expect(screen.getByText("NAT Egress")).toBeTruthy();
    expect(screen.getByText("NAT Masquerade")).toBeTruthy();
    expect(screen.getByText("Conntrack")).toBeTruthy();
    expect(screen.getByText("Firewall Groups")).toBeTruthy();
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

  it("fires the save mutation and invokes its onSuccess", () => {
    withRulesAndSysctl(() => undefined);
    render(<FirewallPage />);
    fireEvent.click(screen.getByText("Save Rules"));
    const save = mutationMap.get("n1:firewall/save")!;
    expect(save.mutate).toHaveBeenCalledWith({});
    save.onSuccess!();
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
});
