"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExternalLink } from "lucide-react";

/** A node row as passed from the server list page. */
export interface NodeRow {
  id: string;
  name: string;
  url: string;
  status: string;
  location?: string | null;
  lastSeen?: Date | string | null;
}

/** Render a last-seen timestamp as a relative string, or "Never". */
export function relativeLastSeen(lastSeen: Date | string | null | undefined): string {
  if (!lastSeen) return "Never";
  return formatDistanceToNow(new Date(lastSeen), { addSuffix: true });
}

/**
 * Client-side sortable/searchable table of dawos-agent nodes.
 * Wraps the shared DataTable with node-specific columns and an empty CTA.
 */
export function NodesTable({ nodes }: { nodes: NodeRow[] }) {
  const columns = useMemo<ColumnDef<NodeRow, unknown>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/nodes/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "url",
        header: "URL",
        cell: ({ row }) => (
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            {row.original.url}
          </span>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => row.original.location || "—",
      },
      {
        id: "lastSeen",
        header: "Last Seen",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {relativeLastSeen(row.original.lastSeen)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/nodes/${row.original.id}`}
            className="text-sm text-primary hover:underline"
          >
            View
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={nodes}
      searchKey="name"
      emptyTitle="No nodes yet"
      emptyDescription="Add your first dawos-agent node to get started."
      emptyAction={{ label: "Add Node", href: "/nodes/new" }}
    />
  );
}
