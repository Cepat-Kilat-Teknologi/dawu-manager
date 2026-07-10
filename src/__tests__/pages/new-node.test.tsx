import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/nodes/new",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

import NewNodePage from "@/app/(dashboard)/nodes/new/page";

describe("NewNodePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the add node form", () => {
    render(<NewNodePage />);
    expect(screen.getAllByText("Add Node").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("URL")).toBeTruthy();
    expect(screen.getByLabelText("API Key")).toBeTruthy();
  });

  it("renders back link and description", () => {
    render(<NewNodePage />);
    expect(screen.getByText("Back to nodes")).toBeTruthy();
    expect(
      screen.getByText("Connect a dawos-agent BNG node to the dashboard."),
    ).toBeTruthy();
  });

  it("renders optional location field", () => {
    render(<NewNodePage />);
    expect(screen.getByLabelText(/Location/)).toBeTruthy();
    expect(screen.getByText("(optional)")).toBeTruthy();
  });

  it("renders cancel button", () => {
    render(<NewNodePage />);
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("submits form and redirects on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ name: "bng-1", status: "online" }),
    } as Response);

    render(<NewNodePage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "bng-1" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "http://192.168.1.10:8470" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "secret-key" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/nodes",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/nodes");
    });
  });

  it("shows error from API response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Duplicate node name" }),
    } as Response);

    render(<NewNodePage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "dup" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "http://192.168.1.10:8470" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "key" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Duplicate node name")).toBeTruthy();
    });
  });

  it("shows error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Connection refused"));

    render(<NewNodePage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "bng-1" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "http://192.168.1.10:8470" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "key" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(
        screen.getByText("An unexpected error occurred."),
      ).toBeTruthy();
    });
  });

  it("shows fallback error when API returns no error field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    render(<NewNodePage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "bng-1" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "http://192.168.1.10:8470" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "key" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Failed to add node.")).toBeTruthy();
    });
  });

  it("sends location when provided", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ name: "bng-1", status: "online" }),
    } as Response);

    render(<NewNodePage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "bng-1" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "http://192.168.1.10:8470" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "key" },
    });
    fireEvent.change(screen.getByLabelText(/Location/), {
      target: { value: "Jakarta DC" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

    await waitFor(() => {
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.location).toBe("Jakarta DC");
    });
  });
});
