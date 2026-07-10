import { handlers } from "@/lib/auth";

/**
 * NextAuth.js catch-all API route.
 * Re-exports the GET and POST handlers from the auth configuration
 * to handle all authentication endpoints (sign-in, sign-out, session, CSRF).
 */
export const { GET, POST } = handlers;
