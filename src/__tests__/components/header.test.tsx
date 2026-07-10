import "@/__tests__/ui-mocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/header";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import "next-auth/react";

// Re-mock useSession to allow per-test overrides
const { mockUseSession, mockSetTheme, mockThemeValue } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSetTheme: vi.fn(),
  mockThemeValue: { value: "light" },
}));

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: () => mockUseSession(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock next-themes for ThemeToggle
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockThemeValue.value, setTheme: mockSetTheme }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock MobileNav to avoid nested Sheet complexity
vi.mock("@/components/layout/mobile-nav", () => ({
  MobileNav: ({ userRole }: { userRole?: string }) => (
    <div data-testid="mobile-nav" data-role={userRole} />
  ),
}));

const defaultSession = {
  data: {
    user: { id: "test-id", name: "Test User", email: "test@test.com", role: "admin" },
    expires: "2099-01-01T00:00:00.000Z",
  },
  status: "authenticated" as const,
};

describe("Header", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(defaultSession);
  });

  it("renders MobileNav", () => {
    render(<Header />);
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
  });

  it("shows user avatar with initials", () => {
    render(<Header />);
    expect(screen.getByText("TU")).toBeInTheDocument(); // "Test User" → "TU"
  });

  it("shows user name", () => {
    render(<Header />);
    const names = screen.getAllByText("Test User");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("shows user role badge", () => {
    render(<Header />);
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows user email in dropdown", () => {
    render(<Header />);
    expect(screen.getByText("test@test.com")).toBeInTheDocument();
  });

  it("calls signOut when sign out clicked", () => {
    render(<Header />);
    const signOutBtn = screen.getByText("Sign out").closest("button")!;
    fireEvent.click(signOutBtn);

    expect(toast.success).toHaveBeenCalledWith("Signed out", {
      description: "You have been signed out.",
    });
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  it("has sticky header styling", () => {
    const { container } = render(<Header />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
  });

  it("hides user menu when session is null", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<Header />);
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("shows ? initials when user name is null", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "x", name: null, email: "x@t.com", role: "viewer" },
        expires: "2099-01-01",
      },
      status: "authenticated",
    });
    render(<Header />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders theme toggle button", () => {
    render(<Header />);
    const toggle = screen.getByLabelText("Toggle theme");
    expect(toggle).toBeInTheDocument();
  });

  it("calls setTheme when theme toggle clicked", () => {
    render(<Header />);
    const toggle = screen.getByLabelText("Toggle theme");
    fireEvent.click(toggle);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles to light when current theme is dark", () => {
    mockThemeValue.value = "dark";
    render(<Header />);
    const toggle = screen.getByLabelText("Toggle theme");
    fireEvent.click(toggle);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
    mockThemeValue.value = "light"; // restore
  });

  it("does not render Profile menu item", () => {
    render(<Header />);
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("renders breadcrumbs", () => {
    render(<Header />);
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
  });

  it("dispatches the command-palette event from both triggers", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<Header />);
    const triggers = screen.getAllByLabelText("Open command palette");
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    for (const trigger of triggers) {
      fireEvent.click(trigger);
    }
    const events = spy.mock.calls
      .map((c) => (c[0] as Event).type)
      .filter((t) => t === "open-command-palette");
    expect(events.length).toBeGreaterThanOrEqual(2);
    spy.mockRestore();
  });
});
