/**
 * Client-side authentication utilities.
 *
 * Encapsulates the NextAuth v5 credentials login workaround.
 * NextAuth v5 beta.31 `signIn("credentials", { redirect: false })` silently
 * fails — this module uses direct fetch to the callback endpoint instead.
 *
 * When NextAuth fixes the bug, update this single file rather than every
 * component that needs programmatic login.
 */

export interface LoginResult {
  /** Whether authentication succeeded. */
  ok: boolean;
  /** Error message on failure, undefined on success. */
  error?: string;
}

/**
 * Authenticate with email and password via NextAuth credentials provider.
 *
 * Two-step process:
 * 1. GET /api/auth/csrf — obtain CSRF token
 * 2. POST /api/auth/callback/credentials — submit credentials
 *
 * Returns a result object instead of throwing, so callers can handle
 * errors with simple conditionals rather than try/catch.
 *
 * @param email - User email address
 * @param password - User password
 * @returns Login result with ok flag and optional error message
 */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<LoginResult> {
  /* Step 1: Fetch CSRF token from NextAuth */
  const csrfRes = await fetch("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  /* Step 2: POST credentials to NextAuth callback endpoint */
  const res = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: "/",
    }),
  });

  const data = await res.json();

  /* Step 3: Check for error in redirect URL */
  const redirectUrl = new URL(data.url, window.location.origin);
  const authError = redirectUrl.searchParams.get("error");

  if (authError || !res.ok) {
    return { ok: false, error: "Invalid email or password." };
  }

  return { ok: true };
}
