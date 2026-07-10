import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/__tests__/ui-mocks";

import { ProxyDataTable, type ProxyColumn } from "@/components/node/proxy-data-table";

interface TestRow {
  id: string;
  name: string;
  status: string;
  count?: number;
}

const columns: ProxyColumn<TestRow>[] = [
  { header: "ID", accessorKey: "id" },
  { header: "Name", accessorKey: "name", className: "font-bold" },
  {
    header: "Status",
    cell: (row) => <span data-testid="custom-cell">{row.status.toUpperCase()}</span>,
  },
];

const data: TestRow[] = [
  { id: "1", name: "Alpha", status: "active" },
  { id: "2", name: "Beta", status: "inactive" },
];

describe("ProxyDataTable", () => {
  it("renders column headers", () => {
    render(<ProxyDataTable columns={columns} data={data} />);

    expect(screen.getByText("ID")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
  });

  it("renders data rows with accessor keys", () => {
    render(<ProxyDataTable columns={columns} data={data} />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("renders custom cell renderers", () => {
    render(<ProxyDataTable columns={columns} data={data} />);

    const customCells = screen.getAllByTestId("custom-cell");
    expect(customCells).toHaveLength(2);
    expect(customCells[0].textContent).toBe("ACTIVE");
    expect(customCells[1].textContent).toBe("INACTIVE");
  });

  it("uses getRowKey for row keys", () => {
    const { container } = render(
      <ProxyDataTable columns={columns} data={data} getRowKey={(r) => r.id} />,
    );

    const rows = container.querySelectorAll('[data-testid="table-row"]');
    // 1 header row + 2 data rows
    expect(rows.length).toBe(3);
  });

  it("renders empty table when no data", () => {
    render(<ProxyDataTable columns={columns} data={[]} />);

    expect(screen.getByText("ID")).toBeTruthy();
    // No data rows
    const rows = screen.getAllByTestId("table-row");
    expect(rows).toHaveLength(1); // header row only
  });

  it("shows dash for missing accessor key values", () => {
    const colsWithMissing: ProxyColumn<TestRow>[] = [
      { header: "Count", accessorKey: "count" },
    ];

    render(
      <ProxyDataTable
        columns={colsWithMissing}
        data={[{ id: "1", name: "Test", status: "ok" }]}
      />,
    );

    // count is undefined, should show "—"
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows dash when no accessorKey and no cell renderer", () => {
    const bareCol: ProxyColumn<TestRow>[] = [{ header: "Empty" }];

    render(<ProxyDataTable columns={bareCol} data={data} />);

    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(2);
  });
});
