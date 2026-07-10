import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthRole = "admin" | "operator" | "viewer";

const ROLE_HIERARCHY: Record<AuthRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

/**
 * Server-side auth guard for use in Server Components and API routes.
 * Redirects to /login if not authenticated.
 * Returns the session with typed user (id, name, email, role).
 */
export async function requireAuth(minRole: AuthRole = "viewer") {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user.role ?? "viewer") as AuthRole;
  if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
    redirect("/");
  }

  return session;
}

/**
 * Check if the current user has at least the given role.
 * For use in API routes (returns boolean instead of redirecting).
 */
export async function hasRole(minRole: AuthRole): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const userRole = (session.user.role ?? "viewer") as AuthRole;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}
