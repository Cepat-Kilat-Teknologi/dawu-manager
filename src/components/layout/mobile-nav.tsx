"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { mainNavItems } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Menu, Server } from "lucide-react";

interface MobileNavProps {
  userRole?: string;
}

/**
 * Mobile-responsive navigation drawer (visible only below `md` breakpoint).
 * Opens as a Sheet from the left edge with the same nav sections as the desktop Sidebar.
 * Automatically closes when a link is clicked.
 * @param userRole - Current user's role for filtering role-restricted nav items
 */
export function MobileNav({ userRole = "viewer" }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="hidden md:block lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <SheetContent side="left" className="w-72 p-0" id="mobile-nav-panel">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-bold">dawu</span>
              <span className="text-xs text-muted-foreground font-medium mt-0.5">
                manager
              </span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6" aria-label="Mobile navigation">
            {mainNavItems.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !item.roles || item.roles.includes(userRole),
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title}>
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {section.title}
                  </p>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(item.href));
                      const Icon = item.icon;

                      return (
                        <SheetClose key={item.href} render={<div />}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground",
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{item.title}</span>
                            {item.badge && (
                              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <Separator />
          <div className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              {APP_NAME} v{APP_VERSION}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
