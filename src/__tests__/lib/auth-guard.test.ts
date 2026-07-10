import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a custom redirect error to simulate Next.js behavior
class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.url = url;
  }
}

// Mock next/navigation with redirect that throws (like Next.js)
const mockRedirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

// Mock auth module
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Import after mocks
import { requireAuth, hasRole } from "@/lib/auth-guard";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session for authenticated user", async () => {
    const session = {
      user: { id: "1", name: "Admin", email: "a@a.com", role: "admin" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    const result = await requireAuth();
    expect(result).toEqual(session);
  });

  it("redirects to /login when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });

    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to / when role insufficient", async () => {
    const session = {
      user: { id: "1", name: "Viewer", email: "v@v.com", role: "viewer" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    await expect(requireAuth("admin")).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("allows operator access to operator-required route", async () => {
    const session = {
      user: { id: "1", name: "Op", email: "o@o.com", role: "operator" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    const result = await requireAuth("operator");
    expect(result).toEqual(session);
  });

  it("allows admin access to operator-required route", async () => {
    const session = {
      user: { id: "1", name: "Admin", email: "a@a.com", role: "admin" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    const result = await requireAuth("operator");
    expect(result).toEqual(session);
  });

  it("defaults to viewer when role is missing", async () => {
    const session = {
      user: { id: "1", name: "User", email: "u@u.com" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    // Default minRole is viewer, user without role defaults to viewer
    const result = await requireAuth();
    expect(result).toEqual(session);
  });

  it("redirects when default-viewer tries admin route", async () => {
    const session = {
      user: { id: "1", name: "User", email: "u@u.com" },
      expires: "2099-01-01",
    };
    mockAuth.mockResolvedValue(session);

    await expect(requireAuth("admin")).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

describe("hasRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user has exact role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Op", email: "o@o.com", role: "operator" },
    });

    expect(await hasRole("operator")).toBe(true);
  });

  it("returns true when user has higher role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Admin", email: "a@a.com", role: "admin" },
    });

    expect(await hasRole("viewer")).toBe(true);
    expect(await hasRole("operator")).toBe(true);
    expect(await hasRole("admin")).toBe(true);
  });

  it("returns false when user has lower role", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Viewer", email: "v@v.com", role: "viewer" },
    });

    expect(await hasRole("operator")).toBe(false);
    expect(await hasRole("admin")).toBe(false);
  });

  it("returns false when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await hasRole("viewer")).toBe(false);
  });

  it("returns false when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });
    expect(await hasRole("viewer")).toBe(false);
  });

  it("defaults to viewer role when role field is missing", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "User", email: "u@u.com" },
    });

    expect(await hasRole("viewer")).toBe(true);
    expect(await hasRole("operator")).toBe(false);
  });
});
