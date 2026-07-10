"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ExternalLink, Info } from "lucide-react";
import { SkeletonTable } from "@/components/shared/skeleton-blocks";
import { ProxyError } from "@/hooks/use-node-proxy";

const DOCS_URL = "https://cepat-kilat-teknologi.github.io/dawos-agent/";

/**
 * Build a user-friendly guidance message based on the HTTP error status code.
 * Returns null for generic errors where no specific guidance applies.
 */
function getErrorGuidance(error: Error): { message: string; hint: string; docsPath?: string } | null {
  if (!(error instanceof ProxyError)) return null;

  switch (error.status) {
    case 405:
      return {
        message: "This endpoint does not support read (GET) requests.",
        hint: "It may require a specific action (POST/PUT/DELETE) through a form or button. Check the dawos-agent documentation for supported methods.",
        docsPath: "api/",
      };
    case 404:
      return {
        message: "This feature is not available on the node.",
        hint: "The required service may not be installed or the endpoint is not supported by this dawos-agent version.",
        docsPath: "installation/",
      };
    case 502:
    case 504:
      return {
        message: "Unable to reach the BNG node.",
        hint: "Check that dawos-agent is running and the node URL is correct. Run: sudo systemctl status dawos-agent",
      };
    case 503:
      return {
        message: "The service is temporarily unavailable.",
        hint: "dawos-agent may be restarting or under maintenance. Try again in a few moments.",
      };
    default:
      return null;
  }
}

interface NodePageShellProps {
  /** Page title displayed in the card header. */
  title: string;
  /** Whether data is currently loading. */
  isLoading: boolean;
  /** Error object if the request failed. */
  error: Error | null;
  /** Callback to retry the failed request. */
  onRetry?: () => void;
  /** Whether the data set is empty (after successful load). */
  isEmpty?: boolean;
  /** Message to show when data is empty. */
  emptyMessage?: string;
  /** Page content rendered when data is available. */
  children: React.ReactNode;
  /** Optional action buttons rendered in the card header. */
  actions?: React.ReactNode;
}

/**
 * Reusable page shell for all per-node category pages.
 * Handles loading spinner, error state with retry, and empty state consistently.
 * Wraps content in a Card with title and optional action buttons.
 */
export function NodePageShell({
  title,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "No data available.",
  children,
  actions,
}: NodePageShellProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent role="status" aria-live="polite">
          <span className="sr-only">Loading...</span>
          <SkeletonTable rows={6} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const guidance = getErrorGuidance(error);
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error.message}</p>
          {guidance && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-3 max-w-md text-center">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Info className="h-3.5 w-3.5" />
                {guidance.message}
              </div>
              <p className="text-xs text-muted-foreground">{guidance.hint}</p>
              {guidance.docsPath && (
                <a
                  href={`${DOCS_URL}${guidance.docsPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View documentation <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="rounded-xl border-border">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="content-fade-in">{children}</CardContent>
    </Card>
  );
}
