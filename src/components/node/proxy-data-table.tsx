"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Column definition for the proxy data table. */
export interface ProxyColumn<T = Record<string, unknown>> {
  /** Column header text. */
  header: string;
  /** Key to access in the data object, or a render function. */
  accessorKey?: string;
  /** Custom cell renderer. */
  cell?: (row: T) => React.ReactNode;
  /** Additional CSS classes for the cell. */
  className?: string;
}

interface ProxyDataTableProps<T = Record<string, unknown>> {
  /** Column definitions. */
  columns: ProxyColumn<T>[];
  /** Array of data rows. */
  data: T[];
  /** Optional key extractor for row keys (default: index). */
  getRowKey?: (row: T, index: number) => string;
}

/**
 * Generic data table for displaying proxy API responses.
 * Accepts column definitions with accessor keys or custom renderers.
 * Renders a responsive table with striped rows.
 */
export function ProxyDataTable<T extends object>({
  columns,
  data,
  getRowKey,
}: ProxyDataTableProps<T>) {
  return (
    <div className="responsive-table rounded-lg border md:max-h-[70vh] md:overflow-auto">
      <Table>
        <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-card">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.header} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={getRowKey ? getRowKey(row, i) : i}
              className="transition-colors hover:bg-accent/40"
            >
              {columns.map((col) => (
                <TableCell
                  key={col.header}
                  className={col.className}
                  data-label={col.header}
                >
                  {col.cell
                    ? col.cell(row)
                    : col.accessorKey
                      ? String((row as Record<string, unknown>)[col.accessorKey] ?? "—")
                      : "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
