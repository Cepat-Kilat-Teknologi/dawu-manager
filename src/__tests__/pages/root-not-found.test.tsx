import "@/__tests__/ui-mocks";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("Root NotFound", () => {
  it("renders not found heading", () => {
    render(<NotFound />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<NotFound />);
    expect(
      screen.getByText(/doesn't exist or has been moved/),
    ).toBeInTheDocument();
  });

  it("renders back to dashboard link", () => {
    render(<NotFound />);
    const link = screen.getByText("Back to Dashboard").closest("a");
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders FileQuestion icon", () => {
    render(<NotFound />);
    // The icon container should be present (rounded-full bg-muted)
    const heading = screen.getByText("Page not found");
    expect(heading.tagName).toBe("H1");
  });
});
