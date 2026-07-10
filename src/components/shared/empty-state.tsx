import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  /** Button label. */
  label: string;
  /** Destination href — rendered as a link when provided. */
  href?: string;
  /** Click handler — used when no href is provided. */
  onClick?: () => void;
}

interface EmptyStateProps {
  /** Icon shown above the title. */
  icon?: LucideIcon;
  /** Primary heading. */
  title: string;
  /** Supporting description text. */
  description?: string;
  /** Optional call-to-action button. */
  action?: EmptyStateAction;
  /** Additional CSS classes for the container. */
  className?: string;
}

/**
 * Centered empty-state block: icon + title + description + optional CTA.
 * Used whenever a data region has no rows to display.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center",
        className,
      )}
      data-testid="empty-state"
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action &&
        (action.href ? (
          <Button render={<Link href={action.href} />} className="mt-5 press-scale">
            {action.label}
          </Button>
        ) : (
          <Button onClick={action.onClick} className="mt-5 press-scale">
            {action.label}
          </Button>
        ))}
    </div>
  );
}
