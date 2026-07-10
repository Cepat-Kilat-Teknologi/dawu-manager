import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteNodeButton } from "@/components/dashboard/delete-node-button";
import { toast } from "sonner";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

describe("DeleteNodeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders delete button", () => {
    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("opens confirmation dialog on click", () => {
    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Delete Node");
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  });

  it("shows node name in confirmation", () => {
    render(<DeleteNodeButton nodeId="n1" nodeName="bng-jakarta-1" />);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("bng-jakarta-1")).toBeInTheDocument();
  });

  it("sends DELETE request and redirects on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);

    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));

    // Click the confirm button (inside dialog-footer)
    const footer = screen.getByTestId("dialog-footer");
    const confirmBtn = footer.querySelector("[data-variant='destructive']") as HTMLElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/nodes/n1", { method: "DELETE" });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Node deleted", expect.anything());
      expect(mockPush).toHaveBeenCalledWith("/nodes");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows fallback error when response has no error message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));

    const footer = screen.getByTestId("dialog-footer");
    const confirmBtn = footer.querySelector("[data-variant='destructive']") as HTMLElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed", {
        description: "Could not delete the node.",
      });
    });
  });

  it("shows error on failed delete", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));

    const footer = screen.getByTestId("dialog-footer");
    const confirmBtn = footer.querySelector("[data-variant='destructive']") as HTMLElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed", expect.anything());
    });
  });

  it("shows error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));

    const footer = screen.getByTestId("dialog-footer");
    const confirmBtn = footer.querySelector("[data-variant='destructive']") as HTMLElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Connection error", expect.anything());
    });
  });

  it("closes dialog on cancel", () => {
    render(<DeleteNodeButton nodeId="n1" nodeName="bng-1" />);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Delete Node");
    fireEvent.click(screen.getByText("Cancel"));
  });
});
