import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/shared/empty-state";
import { Server } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No nodes" description="Add one to begin." />);
    expect(screen.getByText("No nodes")).toBeInTheDocument();
    expect(screen.getByText("Add one to begin.")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const { container } = render(<EmptyState icon={Server} title="Empty" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("renders a link action when href is given", () => {
    render(
      <EmptyState
        title="Empty"
        action={{ label: "Add Node", href: "/nodes/new" }}
      />,
    );
    const link = screen.getByText("Add Node").closest("a");
    expect(link).toHaveAttribute("href", "/nodes/new");
  });

  it("renders a button action with onClick when no href", () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Empty" action={{ label: "Retry", onClick }} />,
    );
    fireEvent.click(screen.getByText("Retry"));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders without description or action", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
