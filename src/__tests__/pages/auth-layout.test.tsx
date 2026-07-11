import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

class RedirectError extends Error {
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

import AuthLayout from "@/app/(auth)/layout";

describe("AuthLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to / when user is already authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Admin", email: "a@t.com", role: "admin" },
    });

    await expect(
      AuthLayout({ children: <div>Login Form</div> }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("renders children in centered container when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const jsx = await AuthLayout({
      children: <div data-testid="child">Login Form</div>,
    });
    render(jsx);

    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByText("Login Form")).toBeTruthy();
  });

  it("has split-panel grid layout classes", async () => {
    mockAuth.mockResolvedValue(null);

    const jsx = await AuthLayout({
      children: <span>Content</span>,
    });
    const { container } = render(jsx);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("grid");
    expect(wrapper.className).toContain("min-h-screen");
    expect(wrapper.className).toContain("lg:grid-cols-2");
  });

  it("renders the brand panel content", async () => {
    mockAuth.mockResolvedValue(null);

    const jsx = await AuthLayout({
      children: <span>Content</span>,
    });
    render(jsx);

    expect(
      screen.getByRole("heading", { name: /Every BNG node/ }),
    ).toBeTruthy();
    expect(screen.getByText("Real-time visibility")).toBeTruthy();
    expect(screen.getByText("Keys never leave the server")).toBeTruthy();
    expect(screen.getByText("No more SSH hopping")).toBeTruthy();
  });

  it("renders children when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });

    const jsx = await AuthLayout({
      children: <div data-testid="setup-form">Setup</div>,
    });
    render(jsx);

    expect(screen.getByTestId("setup-form")).toBeTruthy();
  });
});
