import { vi } from "vitest";
import { cloneElement, isValidElement } from "react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock shadcn/ui card
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>{children}</p>
  ),
}));

// Mock shadcn/ui badge
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

// Mock shadcn/ui button — supports `render` prop (base-ui pattern)
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    variant,
    size,
    disabled,
    onClick,
    render,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
    size?: string;
    disabled?: boolean;
    onClick?: () => void;
    render?: React.ReactElement;
    [key: string]: unknown;
  }) => {
    // When render prop is provided, clone that element with children
    if (render && isValidElement(render)) {
      return cloneElement(render, {
        "data-testid": "button",
        "data-variant": variant,
        "data-size": size,
        className,
        ...props,
      } as Record<string, unknown>, children);
    }
    return (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        className={className}
        disabled={disabled}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    );
  },
}));

// Mock shadcn/ui separator
vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr data-testid="separator" />,
}));

// Mock shadcn/ui avatar
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>{children}</div>
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>{children}</span>
  ),
}));

// Mock shadcn/ui dropdown
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button data-testid="dropdown-trigger" className={className}>{children}</button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button data-testid="dropdown-item" data-variant={variant} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

// Mock shadcn/ui dialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>{children}</div>
  ),
}));

// Mock shadcn/ui sheet
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="sheet" data-open={open}>{children}</div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-header" className={className}>{children}</div>
  ),
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="sheet-title" className={className}>{children}</h2>
  ),
  SheetClose: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-close">{children}</div>
  ),
}));

// Mock shadcn/ui input
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="input" {...props} />
  ),
}));

// Mock shadcn/ui label
vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    ...props
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    [key: string]: unknown;
  }) => (
    <label data-testid="label" htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

// Mock CardDescription (add to card mock)
// Already handled in card mock below - just adding note

// Mock shadcn/ui sonner
vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

// Mock shadcn/ui table
vi.mock("@/components/ui/table", () => ({
  Table: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <table data-testid="table" {...props}>{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr data-testid="table-row">{children}</tr>
  ),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th data-testid="table-head" className={className}>{children}</th>
  ),
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td data-testid="table-cell" className={className}>{children}</td>
  ),
}));
