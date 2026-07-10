import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTransition } from "@/components/shared/page-transition";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
}));

describe("PageTransition", () => {
  it("renders children inside the animated wrapper", () => {
    render(
      <PageTransition>
        <p>page content</p>
      </PageTransition>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
