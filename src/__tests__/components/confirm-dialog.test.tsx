import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Delete Node",
    description: "Are you sure you want to delete this node?",
    onConfirm: vi.fn(),
  };

  it("renders title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Delete Node")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this node?"),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Delete Node")).not.toBeInTheDocument();
  });

  it("renders default confirm label", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("renders custom confirm label", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders Cancel button", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onOpenChange when cancel clicked", () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onConfirm when confirm clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it("disables buttons when loading", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);
    const buttons = screen.getAllByTestId("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("defaults to destructive variant", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByText("Confirm").closest("button");
    expect(confirmBtn).toHaveAttribute("data-variant", "destructive");
  });

  it("supports default variant", () => {
    render(<ConfirmDialog {...defaultProps} variant="default" />);
    const confirmBtn = screen.getByText("Confirm").closest("button");
    expect(confirmBtn).toHaveAttribute("data-variant", "default");
  });
});
