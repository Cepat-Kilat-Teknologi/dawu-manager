import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@/__tests__/ui-mocks";

const { mockPush, mockRefresh, mockLogin } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  loginWithCredentials: (...args: unknown[]) => mockLogin(...args),
}));

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign in form", () => {
    render(<LoginPage />);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("renders branding", () => {
    render(<LoginPage />);
    expect(screen.getByText("dawu")).toBeTruthy();
    expect(screen.getByText("manager")).toBeTruthy();
  });

  it("renders description text", () => {
    render(<LoginPage />);
    expect(
      screen.getByText("Enter your credentials to access the dashboard."),
    ).toBeTruthy();
  });

  it("submits form and redirects on success", async () => {
    mockLogin.mockResolvedValue({ ok: true });
    // Login uses a full navigation (window.location.assign) instead of
    // router.push so the SessionProvider cache is re-primed after sign-in.
    const assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {});

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@test.com", "password123");
    });

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith("/");
    });
    expect(mockPush).not.toHaveBeenCalled();

    assignSpy.mockRestore();
  });

  it("shows error on failed login", async () => {
    mockLogin.mockResolvedValue({
      ok: false,
      error: "Invalid email or password.",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "wrong@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Invalid email or password.")).toBeTruthy();
    });
  });

  it("shows fallback error when result.error is undefined", async () => {
    mockLogin.mockResolvedValue({ ok: false });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass1234" },
    });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Invalid email or password.")).toBeTruthy();
    });
  });

  it("shows error on unexpected exception", async () => {
    mockLogin.mockRejectedValue(new Error("Network error"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass1234" },
    });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(
        screen.getByText("An unexpected error occurred."),
      ).toBeTruthy();
    });
  });
});
