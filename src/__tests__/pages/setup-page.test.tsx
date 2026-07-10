import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/setup",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

import SetupPage from "@/app/(auth)/setup/page";

describe("SetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders setup form with all fields", () => {
    render(<SetupPage />);
    expect(screen.getByText("Welcome to dawu-manager")).toBeTruthy();
    expect(screen.getByLabelText("Full Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm Password")).toBeTruthy();
  });

  it("renders branding", () => {
    render(<SetupPage />);
    expect(screen.getByText("dawu")).toBeTruthy();
    expect(screen.getByText("manager")).toBeTruthy();
  });

  it("renders description", () => {
    render(<SetupPage />);
    expect(
      screen.getByText("Create your administrator account to get started."),
    ).toBeTruthy();
  });

  it("shows error when passwords do not match", async () => {
    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "password456" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    });
  });

  it("shows error when password too short", async () => {
    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "abc" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(
        screen.getByText("Password must be at least 4 characters."),
      ).toBeTruthy();
    });
  });

  it("submits and redirects to login on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "Admin", role: "admin" }),
    } as Response);

    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/setup",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("shows error from API response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Setup already completed" }),
    } as Response);

    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Setup already completed")).toBeTruthy();
    });
  });

  it("shows fallback error when API returns no error field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Setup failed.")).toBeTruthy();
    });
  });

  it("shows error on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    render(<SetupPage />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "securepass123" },
    });
    fireEvent.submit(screen.getByLabelText("Full Name").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(
        screen.getByText("An unexpected error occurred."),
      ).toBeTruthy();
    });
  });
});
