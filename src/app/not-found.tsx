import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

/**
 * Root-level 404 page.
 * Shown when a URL doesn't match any route in the application.
 * Renders a branded, centered layout independent of the dashboard shell.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
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
