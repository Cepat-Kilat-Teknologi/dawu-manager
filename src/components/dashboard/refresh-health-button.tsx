"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface RefreshHealthButtonProps {
  nodeId: string;
}

/**
 * Client-side button that triggers a health check for a specific node.
 * Calls the internal health API endpoint and revalidates the page data
 * instead of opening raw JSON in a new tab.
 */
export function RefreshHealthButton({ nodeId }: RefreshHealthButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/nodes/${nodeId}/health`);
      if (res.ok) {
        toast.success("Health check complete", {
          description: "Node status has been updated.",
        });
      } else {
        toast.error("Health check failed", {
          description: "Could not reach the node.",
        });
      }
      router.refresh();
    } catch {
      toast.error("Health check error", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={loading}
    >
      <RefreshCw
        className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {loading ? "Checking..." : "Refresh Health"}
    </Button>
  );
}
