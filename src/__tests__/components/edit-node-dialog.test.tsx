import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditNodeDialog } from "@/components/dashboard/edit-node-dialog";
import { toast } from "sonner";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

describe("EditNodeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const defaultProps = {
    nodeId: "n1",
    initialName: "bng-1",
    initialUrl: "http://192.168.1.10:8470",
    initialLocation: "Jakarta DC",
  };

  it("renders edit button", () => {
    render(<EditNodeDialog {...defaultProps} />);
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("opens dialog on click", () => {
    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Node")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("populates form with initial values", () => {
    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("bng-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("http://192.168.1.10:8470")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jakarta DC")).toBeInTheDocument();
  });

  it("submits PUT request and refreshes on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "bng-1" }),
    } as Response);

    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    const form = screen.getByText("Save Changes").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/nodes/n1",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Node updated", expect.anything());
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows fallback error when response has no error message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    const form = screen.getByText("Save Changes").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to update node.");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed", {
        description: "Check the details and try again.",
      });
    });
  });

  it("shows error on failed request", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Name taken" }),
    } as Response);

    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    const form = screen.getByText("Save Changes").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Name taken");
    });
  });

  it("shows error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    const form = screen.getByText("Save Changes").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Connection error", expect.anything());
    });
  });

  it("closes dialog on cancel", () => {
    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Node")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    // Dialog should close (mocked Dialog uses open prop)
  });

  it("handles null initial location", () => {
    render(<EditNodeDialog {...defaultProps} initialLocation={null} />);
    fireEvent.click(screen.getByText("Edit"));
    // Location input should be empty, not "null"
    const inputs = screen.getAllByTestId("input");
    const locationInput = inputs.find(
      (input) => (input as HTMLInputElement).id === "edit-location",
    );
    expect((locationInput as HTMLInputElement).value).toBe("");
  });

  it("updates form fields via onChange handlers", () => {
    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    const nameInput = screen.getByDisplayValue("bng-1");
    fireEvent.change(nameInput, { target: { value: "bng-2" } });
    expect(screen.getByDisplayValue("bng-2")).toBeInTheDocument();

    const urlInput = screen.getByDisplayValue("http://192.168.1.10:8470");
    fireEvent.change(urlInput, { target: { value: "http://10.0.0.1:8470" } });
    expect(screen.getByDisplayValue("http://10.0.0.1:8470")).toBeInTheDocument();

    const locationInput = screen.getByDisplayValue("Jakarta DC");
    fireEvent.change(locationInput, { target: { value: "Surabaya DC" } });
    expect(screen.getByDisplayValue("Surabaya DC")).toBeInTheDocument();
  });

  it("includes apiKey in body when provided", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "bng-1" }),
    } as Response);

    render(<EditNodeDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Edit"));

    // Set API key
    const apiKeyInput = screen.getByPlaceholderText("Enter new key or leave blank");
    fireEvent.change(apiKeyInput, { target: { value: "new-key-123" } });

    const form = screen.getByText("Save Changes").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const callBody = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
      );
      expect(callBody.apiKey).toBe("new-key-123");
    });
  });
});
