import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Auth layout for login and setup pages.
 * Centers its children both vertically and horizontally on a muted background.
 *
 * Guard (DM-M18): If user is already authenticated, redirect to dashboard.
 * Per-page guards (setup vs login) are handled in the individual pages.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {children}
    </div>
  );
}
