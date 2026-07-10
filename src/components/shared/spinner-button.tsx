"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface SpinnerButtonProps extends ButtonProps {
  /** When true, the button is disabled and shows a spinner. */
  loading: boolean;
  /** Optional label to show in place of children while loading. */
  loadingText?: string;
}

/**
 * Button that shows a spinner and disables itself while a mutation is in flight.
 * When `loading` is true the children are swapped for `loadingText` (if provided)
 * and a `Loader2` spinner is prepended. Adds the `.press-scale` press feedback.
 */
export function SpinnerButton({
  loading,
  loadingText,
  disabled,
  children,
  className,
  ...props
}: SpinnerButtonProps) {
  return (
    <Button
      disabled={loading || disabled}
      className={cn("press-scale", className)}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
