import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardNotFound from "@/app/(dashboard)/not-found";

describe("DashboardNotFound", () => {
  it("renders not found message", () => {
    render(<DashboardNotFound />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<DashboardNotFound />);
    expect(
      screen.getByText(/doesn't exist or has been moved/),
    ).toBeInTheDocument();
  });

  it("renders back to dashboard link", () => {
    render(<DashboardNotFound />);
    const link = screen.getByText("Back to Dashboard").closest("a");
    expect(link).toHaveAttribute("href", "/");
  });
});
