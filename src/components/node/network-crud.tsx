"use client";

import { useState } from "react";
import { useNodeProxyMutation } from "@/hooks/use-node-proxy";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormAlert } from "@/components/shared/form-alert";
import { SpinnerButton } from "@/components/shared/spinner-button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** Minimal kernel-route shape needed to delete a route. */
export interface RouteRow {
  destination: string;
  gateway?: string;
}

/** Minimal VLAN shape needed to delete a VLAN. */
export interface VlanRow {
  name: string;
  vlan_id: number;
}

/** Matches a non-negative integer (route metric): digits only. */
const NON_NEG_INT = /^\d+$/;
/** Matches a positive integer with no leading zero (VLAN id ≥ 1). */
const POS_INT = /^[1-9]\d*$/;

/**
 * "Add Route" button + dialog. Submits `POST network/routes` with
 * `{destination, gateway, device?, metric?}` and refreshes the routes table.
 */
export function AddRouteDialog({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [gateway, setGateway] = useState("");
  const [device, setDevice] = useState("");
  const [metric, setMetric] = useState("");
  const [error, setError] = useState("");

  const add = useNodeProxyMutation<Record<string, unknown>>(nodeId, "network/routes", {
    method: "POST",
    invalidates: ["network/routes"],
  });

  function reset() {
    setDestination("");
    setGateway("");
    setDevice("");
    setMetric("");
    setError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dest = destination.trim();
    const gw = gateway.trim();
    const dev = device.trim();
    const met = metric.trim();

    if (!dest || !gw) {
      setError("Destination and gateway are required.");
      return;
    }
    if (met !== "" && !NON_NEG_INT.test(met)) {
      setError("Metric must be a non-negative integer.");
      return;
    }

    const body: Record<string, unknown> = { destination: dest, gateway: gw };
    if (dev !== "") body.device = dev;
    if (met !== "") body.metric = Number(met);

    setError("");
    add.mutate(body, {
      onSuccess: () => {
        toast.success("Route added", { description: `${dest} via ${gw}` });
        setOpen(false);
      },
      onError: (err) =>
        toast.error("Failed to add route", { description: err.message }),
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Route
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Route</DialogTitle>
            <DialogDescription>
              Add a static kernel route on this node.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormAlert message={error} />
            <div className="space-y-2">
              <Label htmlFor="route-destination">Destination</Label>
              <Input
                id="route-destination"
                placeholder="10.0.0.0/24 or default"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={add.isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route-gateway">Gateway</Label>
              <Input
                id="route-gateway"
                placeholder="192.168.1.1"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                disabled={add.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route-device">
                Device{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="route-device"
                placeholder="ens19"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                disabled={add.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route-metric">
                Metric{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="route-metric"
                inputMode="numeric"
                placeholder="100"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                disabled={add.isPending}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={add.isPending}
              >
                Cancel
              </Button>
              <SpinnerButton type="submit" loading={add.isPending} loadingText="Adding…">
                Add Route
              </SpinnerButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Per-row delete button for a route. Confirms first, then submits
 * `DELETE network/routes` with `{destination, gateway?}`.
 */
export function DeleteRouteButton({
  nodeId,
  route,
}: {
  nodeId: string;
  route: RouteRow;
}) {
  const [open, setOpen] = useState(false);

  const del = useNodeProxyMutation<Record<string, string>>(nodeId, "network/routes", {
    method: "DELETE",
    invalidates: ["network/routes"],
  });

  function handleConfirm() {
    const body: Record<string, string> = { destination: route.destination };
    if (route.gateway) body.gateway = route.gateway;
    del.mutate(body, {
      onSuccess: () => {
        toast.success("Route deleted");
        setOpen(false);
      },
      onError: (err) =>
        toast.error("Failed to delete route", { description: err.message }),
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={del.isPending}
        aria-label={`Delete route ${route.destination}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete route?"
        description={`Remove the route to ${route.destination}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}

/**
 * "Add VLAN" button + dialog. Submits `POST network/vlans` with
 * `{parent, vlan_id, address?}` and refreshes the VLAN + interfaces tables.
 */
export function AddVlanDialog({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState("");
  const [vlanId, setVlanId] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const add = useNodeProxyMutation<Record<string, unknown>>(nodeId, "network/vlans", {
    method: "POST",
    invalidates: ["network/vlans", "network/interfaces"],
  });

  function reset() {
    setParent("");
    setVlanId("");
    setAddress("");
    setError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const par = parent.trim();
    const vid = vlanId.trim();
    const addr = address.trim();

    if (!par) {
      setError("Parent interface is required.");
      return;
    }
    if (!POS_INT.test(vid)) {
      setError("VLAN ID must be a positive integer.");
      return;
    }

    const body: Record<string, unknown> = { parent: par, vlan_id: Number(vid) };
    if (addr !== "") body.address = addr;

    setError("");
    add.mutate(body, {
      onSuccess: () => {
        toast.success("VLAN added", { description: `${par}.${vid}` });
        setOpen(false);
      },
      onError: (err) =>
        toast.error("Failed to add VLAN", { description: err.message }),
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add VLAN
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add VLAN</DialogTitle>
            <DialogDescription>
              Create a tagged VLAN sub-interface on this node.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormAlert message={error} />
            <div className="space-y-2">
              <Label htmlFor="vlan-parent">Parent</Label>
              <Input
                id="vlan-parent"
                placeholder="ens18"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                disabled={add.isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vlan-id">VLAN ID</Label>
              <Input
                id="vlan-id"
                inputMode="numeric"
                placeholder="100"
                value={vlanId}
                onChange={(e) => setVlanId(e.target.value)}
                disabled={add.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vlan-address">
                Address{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="vlan-address"
                placeholder="10.10.0.1/24"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={add.isPending}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={add.isPending}
              >
                Cancel
              </Button>
              <SpinnerButton type="submit" loading={add.isPending} loadingText="Adding…">
                Add VLAN
              </SpinnerButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Per-row delete button for a VLAN. Confirms first, then submits
 * `DELETE network/vlans/{name}` (VLAN name is a path parameter, no body).
 */
export function DeleteVlanButton({
  nodeId,
  vlan,
}: {
  nodeId: string;
  vlan: VlanRow;
}) {
  const [open, setOpen] = useState(false);

  const del = useNodeProxyMutation<void>(nodeId, `network/vlans/${vlan.name}`, {
    method: "DELETE",
    invalidates: ["network/vlans", "network/interfaces"],
  });

  function handleConfirm() {
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success("VLAN deleted");
        setOpen(false);
      },
      onError: (err) =>
        toast.error("Failed to delete VLAN", { description: err.message }),
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={del.isPending}
        aria-label={`Delete VLAN ${vlan.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete VLAN?"
        description={`Remove VLAN ${vlan.name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
