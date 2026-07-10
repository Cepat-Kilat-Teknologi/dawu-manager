"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { FormAlert } from "@/components/shared/form-alert";
import { SpinnerButton } from "@/components/shared/spinner-button";

/**
 * Add Node page.
 * Renders a form to register a new dawos-agent node with name, URL, API key,
 * and optional location. Encrypts the API key server-side before storage.
 * Validates connectivity via health check on creation.
 */
export default function NewNodePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Handle new node form submission — sends POST /api/nodes with node details.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          apiKey,
          location: location || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add node.");
        toast.error("Failed to add node", { description: data.error || "Check the connection details." });
        return;
      }

      const data = await res.json();
      toast.success("Node added!", {
        description: `${data.name} is ${data.status}.`,
      });
      router.push("/nodes");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
      toast.error("Connection error", { description: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href="/nodes" />} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to nodes</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Node</h1>
          <p className="text-muted-foreground">
            Connect a dawos-agent BNG node to the dashboard.
          </p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Node Details</CardTitle>
          <CardDescription>
            Enter the connection details for the dawos-agent instance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormAlert message={error} />
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="bng-jakarta-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                A unique identifier for this node.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="http://192.168.1.10:8470"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                The base URL of the dawos-agent instance (including port).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter the X-API-Key from agent.env"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                The API key is encrypted before storage. Found in{" "}
                <code className="text-xs">/etc/dawos-agent/agent.env</code>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">
                Location{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="location"
                placeholder="Jakarta DC"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <SpinnerButton type="submit" loading={loading} loadingText="Adding…">
                Add Node
              </SpinnerButton>
              <Button render={<Link href="/nodes" />} type="button" variant="outline">
                  Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
