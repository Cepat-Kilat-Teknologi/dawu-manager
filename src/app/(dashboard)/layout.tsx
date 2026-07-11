import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CommandPalette } from "@/components/command-palette";
import { PageTransition } from "@/components/shared/page-transition";

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
    <div className="min-h-screen lg:pl-[260px]">
      <Sidebar userRole={session.user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-4 pb-24 md:p-6 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
    </div>
  );
}
