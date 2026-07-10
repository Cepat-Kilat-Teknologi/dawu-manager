import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/__tests__/ui-mocks";

import { NodePageShell } from "@/components/node/node-page-shell";
import { ProxyError } from "@/hooks/use-node-proxy";

describe("NodePageShell", () => {
  it("renders loading state with spinner", () => {
    render(
      <NodePageShell title="Test" isLoading={true} error={null}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("Content")).toBeNull();
  });

  it("renders error state with message", () => {
    render(
      <NodePageShell title="Test" isLoading={false} error={new Error("Something failed")}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Something failed")).toBeTruthy();
    expect(screen.queryByText("Content")).toBeNull();
  });

  it("renders retry button on error when onRetry provided", () => {
    const onRetry = vi.fn();
    render(
      <NodePageShell title="Test" isLoading={false} error={new Error("Fail")} onRetry={onRetry}>
        <p>Content</p>
      </NodePageShell>,
    );

    const retryBtn = screen.getByText("Retry");
    expect(retryBtn).toBeTruthy();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render retry button when no onRetry", () => {
    render(
      <NodePageShell title="Test" isLoading={false} error={new Error("Fail")}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("renders empty state", () => {
    render(
      <NodePageShell
        title="Items"
        isLoading={false}
        error={null}
        isEmpty={true}
        emptyMessage="Nothing here."
      >
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Nothing here.")).toBeTruthy();
    expect(screen.getByText("Items")).toBeTruthy();
    expect(screen.queryByText("Content")).toBeNull();
  });

  it("uses default empty message", () => {
    render(
      <NodePageShell title="Items" isLoading={false} error={null} isEmpty={true}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("No data available.")).toBeTruthy();
  });

  it("renders content with title and actions", () => {
    render(
      <NodePageShell
        title="My Section"
        isLoading={false}
        error={null}
        actions={<button>Refresh</button>}
      >
        <p>Hello World</p>
      </NodePageShell>,
    );

    expect(screen.getByText("My Section")).toBeTruthy();
    expect(screen.getByText("Hello World")).toBeTruthy();
    expect(screen.getByText("Refresh")).toBeTruthy();
  });

  it("renders content without actions", () => {
    render(
      <NodePageShell title="Bare" isLoading={false} error={null}>
        <p>Just content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Just content")).toBeTruthy();
  });

  it("prioritizes loading over error", () => {
    render(
      <NodePageShell title="Test" isLoading={true} error={new Error("Err")}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("Err")).toBeNull();
  });

  it("prioritizes error over empty", () => {
    render(
      <NodePageShell title="Test" isLoading={false} error={new Error("Err")} isEmpty={true}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Err")).toBeTruthy();
    expect(screen.queryByText("No data available.")).toBeNull();
  });

  it("shows 405 guidance with docs link for ProxyError", () => {
    render(
      <NodePageShell
        title="NAT Masquerade"
        isLoading={false}
        error={new ProxyError("Method Not Allowed", 405)}
      >
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Method Not Allowed")).toBeTruthy();
    expect(screen.getByText("This endpoint does not support read (GET) requests.")).toBeTruthy();
    expect(screen.getByText(/Check the dawos-agent documentation/)).toBeTruthy();
    const link = screen.getByText("View documentation");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toContain("dawos-agent");
    expect(link.closest("a")?.getAttribute("target")).toBe("_blank");
  });

  it("shows 404 guidance for missing service", () => {
    render(
      <NodePageShell
        title="Traffic"
        isLoading={false}
        error={new ProxyError("Request failed (404)", 404)}
      >
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("This feature is not available on the node.")).toBeTruthy();
    expect(screen.getByText(/service may not be installed/)).toBeTruthy();
    expect(screen.getByText("View documentation")).toBeTruthy();
  });

  it("shows 502 guidance for unreachable node", () => {
    render(
      <NodePageShell
        title="Sessions"
        isLoading={false}
        error={new ProxyError("Request failed (502)", 502)}
      >
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Unable to reach the BNG node.")).toBeTruthy();
    expect(screen.getByText(/dawos-agent is running/)).toBeTruthy();
    expect(screen.queryByText("View documentation")).toBeNull();
  });

  it("shows 503 guidance for temporary unavailability", () => {
    render(
      <NodePageShell
        title="Config"
        isLoading={false}
        error={new ProxyError("Service Unavailable", 503)}
      >
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("The service is temporarily unavailable.")).toBeTruthy();
    expect(screen.getByText(/restarting or under maintenance/)).toBeTruthy();
  });

  it("shows no guidance for generic errors (non-ProxyError)", () => {
    render(
      <NodePageShell title="Test" isLoading={false} error={new Error("Unknown error")}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Unknown error")).toBeTruthy();
    expect(screen.queryByText("View documentation")).toBeNull();
    expect(screen.queryByText(/does not support/)).toBeNull();
  });

  it("shows no guidance for unhandled ProxyError status codes", () => {
    render(
      <NodePageShell title="Test" isLoading={false} error={new ProxyError("Server error", 500)}>
        <p>Content</p>
      </NodePageShell>,
    );

    expect(screen.getByText("Server error")).toBeTruthy();
    expect(screen.queryByText("View documentation")).toBeNull();
    expect(screen.queryByText(/does not support/)).toBeNull();
  });
});
