/**
 * Application branding/logo block.
 *
 * Renders the dawu-manager icon + wordmark combo used on auth pages.
 * Extracted to ensure consistent branding across login, setup, and
 * any future public-facing pages.
 */
import { Server } from "lucide-react";

export function AppLogo() {
  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-2">
        <Server className="h-8 w-8 text-primary" aria-hidden="true" />
        <div className="text-left">
          <span className="text-xl font-bold tracking-tight">dawu</span>
          <span className="text-xs text-muted-foreground font-medium ml-0.5">
            manager
          </span>
        </div>
      </div>
    </div>
  );
}
