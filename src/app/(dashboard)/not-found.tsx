import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

/**
 * Dashboard 404 page.
 * Shown when a dashboard route calls notFound() or when navigating
 * to a non-existent path within the dashboard layout.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button render={<Link href="/" />} variant="outline">
        Back to Dashboard
      </Button>
    </div>
  );
}
