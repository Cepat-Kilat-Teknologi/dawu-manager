"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonTable } from "@/components/shared/skeleton-blocks";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Inbox, Search } from "lucide-react";

interface DataTableProps<TData> {
  /** Column definitions (TanStack Table v8). */
  columns: ColumnDef<TData, unknown>[];
  /** Row data. */
  data: TData[];
  /** Show the loading skeleton instead of the table. */
  loading?: boolean;
  /** Error message — renders an ErrorState instead of the table. */
  error?: string | null;
  /** Retry handler passed to the ErrorState. */
  onRetry?: () => void;
  /** Column id to wire the search box to (renders a search input when set). */
  searchKey?: string;
  /** Empty-state title. */
  emptyTitle?: string;
  /** Empty-state description. */
  emptyDescription?: string;
  /** Empty-state CTA action. */
  emptyAction?: { label: string; href?: string; onClick?: () => void };
  /** Render a leading checkbox selection column. */
  enableSelection?: boolean;
  /** Called with the selected rows whenever the selection changes. */
  onSelectionChange?: (rows: TData[]) => void;
}

/**
 * Turn a column's header definition into a plain label for the mobile card view.
 */
function headerLabel<TData>(col: ColumnDef<TData, unknown>): string {
  return typeof col.header === "string" ? col.header : String(col.id);
}

/**
 * Generic, responsive data table built on TanStack Table v8.
 *
 * Features: sticky sortable header, optional row-selection checkboxes, an
 * optional search box, and built-in loading / error / empty states. On screens
 * below `md` the table collapses into a stacked card list using the column
 * headers as field labels.
 */
export function DataTable<TData>({
  columns,
  data,
  loading,
  error,
  onRetry,
  searchKey,
  emptyTitle = "No data",
  emptyDescription,
  emptyAction,
  enableSelection,
  onSelectionChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableSelection) return columns;
    const selectionColumn: ColumnDef<TData, unknown> = {
      id: "select",
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all rows"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Select row"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    };
    return [selectionColumn, ...columns];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, rowSelection, globalFilter },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  useEffect(() => {
    onSelectionChange?.(
      table.getSelectedRowModel().rows.map((r) => r.original),
    );
  }, [rowSelection, onSelectionChange, table]);

  if (loading) {
    return <SkeletonTable rows={6} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const searchBox = searchKey ? (
    <div className="relative max-w-xs">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label="Search"
        placeholder="Search…"
        value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
        onChange={(e) =>
          table.getColumn(searchKey)?.setFilterValue(e.target.value)
        }
        className="pl-8"
      />
    </div>
  ) : null;

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {searchBox}
        <EmptyState
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchBox}

      {/* Desktop / tablet: real table with horizontal scroll */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 z-10 bg-card"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1.5 font-medium hover:text-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ArrowUpDown
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="transition-colors hover:bg-muted/40"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked card list */}
      <div className="space-y-3 md:hidden" data-testid="data-table-cards">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            {row
              .getVisibleCells()
              .filter((cell) => cell.column.id !== "select")
              .map((cell) => (
                <div
                  key={cell.id}
                  className="flex items-center justify-between gap-3 py-1 text-sm"
                >
                  <span className="text-muted-foreground">
                    {headerLabel(cell.column.columnDef)}
                  </span>
                  <span className={cn("text-right font-medium")}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
