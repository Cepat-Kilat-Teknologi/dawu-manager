import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";

interface Row {
  id: string;
  name: string;
  value: number;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => row.original.name },
  { accessorKey: "value", header: "Value", cell: ({ row }) => row.original.value },
];

const data: Row[] = [
  { id: "1", name: "bravo", value: 2 },
  { id: "2", name: "alpha", value: 1 },
];

describe("DataTable", () => {
  it("renders a skeleton while loading", () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
  });

  it("renders an error state with retry", () => {
    const onRetry = vi.fn();
    render(
      <DataTable columns={columns} data={[]} error="Boom" onRetry={onRetry} />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders an empty state with a CTA when there is no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyTitle="Nothing"
        emptyDescription="Add something"
        emptyAction={{ label: "Add", href: "/new" }}
      />,
    );
    expect(screen.getByText("Nothing")).toBeInTheDocument();
    expect(screen.getByText("Add something")).toBeInTheDocument();
    expect(screen.getByText("Add").closest("a")).toHaveAttribute("href", "/new");
  });

  it("renders rows in both the table and the mobile card list", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getAllByText("bravo").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("data-table-cards")).toBeInTheDocument();
  });

  it("labels mobile cards by column id when the header is not a string", () => {
    const cols: ColumnDef<Row, unknown>[] = [
      {
        id: "custom",
        header: () => <span>Custom Header</span>,
        cell: ({ row }) => row.original.name,
      },
    ];
    render(<DataTable columns={cols} data={data} />);
    const cards = screen.getByTestId("data-table-cards");
    expect(within(cards).getAllByText("custom").length).toBeGreaterThan(0);
  });

  it("sorts when a sortable header is clicked", () => {
    render(<DataTable columns={columns} data={data} />);
    const table = screen.getByTestId("table");
    // Sort by Name ascending → alpha first
    const nameHeader = within(table).getByText("Name");
    fireEvent.click(nameHeader);
    const bodyRows = within(table)
      .getByTestId("table-body")
      .querySelectorAll("[data-testid='table-row']");
    expect(within(bodyRows[0] as HTMLElement).getByText("alpha")).toBeInTheDocument();
  });

  it("filters via the search box", () => {
    render(<DataTable columns={columns} data={data} searchKey="name" />);
    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "alpha" } });
    const table = screen.getByTestId("table");
    expect(within(table).getByText("alpha")).toBeInTheDocument();
    expect(within(table).queryByText("bravo")).not.toBeInTheDocument();
  });

  it("shows the empty state (with search box) when a filter matches nothing", () => {
    render(<DataTable columns={columns} data={data} searchKey="name" />);
    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("supports row selection", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        enableSelection
        onSelectionChange={onSelectionChange}
      />,
    );
    const rowCheckboxes = screen.getAllByLabelText("Select row");
    fireEvent.click(rowCheckboxes[0]);
    const lastCall = onSelectionChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveLength(1);
  });

  it("supports select-all", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        enableSelection
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Select all rows"));
    const lastCall = onSelectionChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveLength(2);
  });
});
