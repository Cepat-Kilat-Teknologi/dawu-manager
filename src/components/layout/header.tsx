"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LogOut, Moon, Sun, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Extract up to two uppercase initials from a user's display name.
 * @param name - The user's full name, or null/undefined
 * @returns One or two capital letters (e.g. "SJ"), or "?" if name is empty
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Theme toggle button — cycles between light, dark, and system themes.
 * Uses next-themes for theme persistence across sessions.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" aria-hidden="true" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" aria-hidden="true" />
    </Button>
  );
}

/**
 * Top application header bar.
 * Displays the mobile hamburger menu on small screens, a theme toggle,
 * and a user dropdown menu (avatar, name, role badge, sign-out action).
 */
export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      {/* Mobile hamburger (tablet only) */}
      <MobileNav userRole={user?.role} />

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new Event("open-command-palette"))
        }
        aria-label="Open command palette"
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>Search…</span>
        <kbd className="rounded border border-border bg-background px-1.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      {/* Command palette trigger (compact, mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-foreground sm:hidden"
        onClick={() =>
          window.dispatchEvent(new Event("open-command-palette"))
        }
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* User menu */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex h-9 items-center gap-2 rounded-md px-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User menu"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-flex text-sm font-medium">
              {user.name}
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] h-5">
              {user.role}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                toast.success("Signed out", { description: "You have been signed out." });
                signOut({ redirectTo: "/login" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
