"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Dashboard error boundary.
 * Catches runtime errors in dashboard routes and displays a recovery UI.
 * Logs the error to console for debugging and provides a retry button.
 */
export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          An unexpected error occurred while loading this page.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs">
              Error ID: {error.digest}
            </span>
          )}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
