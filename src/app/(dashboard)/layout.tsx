import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

/**
 * Protected dashboard layout (server component).
 * Guards all dashboard routes with two checks:
 * 1. If no users exist → redirect to /setup (first-run flow)
 * 2. If not authenticated → redirect to /login
 * Renders the sidebar, header, and main content area.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if any user exists — first-run redirects to setup
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  // Require authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={session.user.role} />
      <div className="flex flex-1 flex-col md:pl-64">
        <Header />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
