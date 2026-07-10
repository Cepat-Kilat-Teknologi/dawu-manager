import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal("fetch", mockFetch);

import { loginWithCredentials } from "@/lib/auth-client";

describe("loginWithCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true on successful login", async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: "csrf-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: "http://localhost:3789/" }),
      });

    const result = await loginWithCredentials("admin@test.com", "password");

    expect(result).toEqual({ ok: true });
  });

  it("fetches CSRF token first", async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: "csrf-abc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: "http://localhost:3789/" }),
      });

    await loginWithCredentials("user@test.com", "pass");

    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf");
  });

  it("sends credentials with correct headers and body", async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: "csrf-xyz" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: "http://localhost:3789/" }),
      });

    await loginWithCredentials("user@test.com", "secret");

    const callbackCall = mockFetch.mock.calls[1];
    expect(callbackCall[0]).toBe("/api/auth/callback/credentials");
    expect(callbackCall[1].method).toBe("POST");
    expect(callbackCall[1].headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(callbackCall[1].headers["X-Auth-Return-Redirect"]).toBe("1");

    const body = callbackCall[1].body as URLSearchParams;
    expect(body.get("email")).toBe("user@test.com");
    expect(body.get("password")).toBe("secret");
    expect(body.get("csrfToken")).toBe("csrf-xyz");
    expect(body.get("callbackUrl")).toBe("/");
  });

  it("returns ok:false when redirect URL contains error param", async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: "csrf-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "http://localhost:3789/login?error=CredentialsSignin",
          }),
      });

    const result = await loginWithCredentials("wrong@test.com", "wrongpass");

    expect(result).toEqual({ ok: false, error: "Invalid email or password." });
  });

  it("returns ok:false when response is not ok", async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: "csrf-123" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ url: "http://localhost:3789/login" }),
      });

    const result = await loginWithCredentials("test@test.com", "pass");

    expect(result).toEqual({ ok: false, error: "Invalid email or password." });
  });

  it("propagates fetch errors to the caller", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    await expect(
      loginWithCredentials("test@test.com", "pass"),
    ).rejects.toThrow("Network failure");
  });
});
