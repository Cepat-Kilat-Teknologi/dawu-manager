"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteNodeButtonProps {
  nodeId: string;
  nodeName: string;
}

/**
 * Delete node button with confirmation dialog.
 * Shows a destructive confirmation before sending DELETE /api/nodes/:nodeId.
 * Redirects to the node list on successful deletion.
 */
export function DeleteNodeButton({ nodeId, nodeName }: DeleteNodeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    try {
      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        toast.error("Delete failed", {
          description: data.error || "Could not delete the node.",
        });
        return;
      }

      toast.success("Node deleted", {
        description: `${nodeName} has been removed.`,
      });
      setOpen(false);
      router.push("/nodes");
      router.refresh();
    } catch {
      toast.error("Connection error", {
        description: "Could not reach the server.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{nodeName}</strong>? This
              action cannot be undone. All audit logs for this node will be
              preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
