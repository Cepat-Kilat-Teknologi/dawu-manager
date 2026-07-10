import "@/__tests__/ui-mocks";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpinnerButton } from "@/components/shared/spinner-button";

describe("SpinnerButton", () => {
  it("renders children when not loading", () => {
    render(<SpinnerButton loading={false}>Save</SpinnerButton>);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows loadingText and disables while loading", () => {
    render(
      <SpinnerButton loading loadingText="Saving…">
        Save
      </SpinnerButton>,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  it("keeps children while loading when no loadingText given", () => {
    render(<SpinnerButton loading>Submit</SpinnerButton>);
    expect(screen.getByText("Submit")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  it("stays disabled when the disabled prop is set", () => {
    render(
      <SpinnerButton loading={false} disabled>
        Go
      </SpinnerButton>,
    );
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  it("forwards click handlers when idle", () => {
    const onClick = vi.fn();
    render(
      <SpinnerButton loading={false} onClick={onClick}>
        Go
      </SpinnerButton>,
    );
    fireEvent.click(screen.getByTestId("button"));
    expect(onClick).toHaveBeenCalled();
  });
});
