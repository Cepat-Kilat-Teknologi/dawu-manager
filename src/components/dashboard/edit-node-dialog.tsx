"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-alert";

interface EditNodeDialogProps {
  nodeId: string;
  initialName: string;
  initialUrl: string;
  initialLocation: string | null;
}

/**
 * Dialog for editing an existing dawos-agent node.
 * Allows updating name, URL, API key (optional), and location.
 * Submits PUT /api/nodes/:nodeId and refreshes the page on success.
 */
export function EditNodeDialog({
  nodeId,
  initialName,
  initialUrl,
  initialLocation,
}: EditNodeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [apiKey, setApiKey] = useState("");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleOpen() {
    setName(initialName);
    setUrl(initialUrl);
    setApiKey("");
    setLocation(initialLocation ?? "");
    setError("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = { name, url, location };
      if (apiKey) {
        body.apiKey = apiKey;
      }

      const res = await fetch(`/api/nodes/${nodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update node.");
        toast.error("Update failed", {
          description: data.error || "Check the details and try again.",
        });
        return;
      }

      toast.success("Node updated", {
        description: `${name} has been updated.`,
      });
      setOpen(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
      toast.error("Connection error", {
        description: "Could not reach the server.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
            <DialogDescription>
              Update the connection details for this node.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormAlert message={error} />
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apiKey">
                API Key{" "}
                <span className="text-muted-foreground font-normal">
                  (leave blank to keep current)
                </span>
              </Label>
              <Input
                id="edit-apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                disabled={loading}
                placeholder="Enter new key or leave blank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">
                Location{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
