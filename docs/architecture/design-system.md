# Design System

dawu-manager uses shadcn/ui v5 with the base-nova style as its component library, built on @base-ui/react and styled with Tailwind CSS v4. This page documents the design system architecture, component conventions, and patterns used throughout the application.

---

## Component Library

### shadcn/ui v5

shadcn/ui provides accessible, composable UI primitives. Unlike traditional component libraries, shadcn/ui components are copied into the project source code (`src/components/ui/`), allowing full customization without forking a dependency.

| Property | Value |
|----------|-------|
| Library | shadcn/ui v5 |
| Foundation | @base-ui/react (NOT Radix) |
| Style | base-nova |
| CSS | Tailwind CSS v4 |
| Configuration | `components.json` |

### Available Components

The following shadcn/ui components are installed and used throughout the application:

| Component | File | Usage |
|-----------|------|-------|
| Avatar | `ui/avatar.tsx` | User profile display in header |
| Badge | `ui/badge.tsx` | Status indicators, role labels |
| Button | `ui/button.tsx` | All interactive buttons |
| Card | `ui/card.tsx` | Node cards, stat cards, content containers |
| Dialog | `ui/dialog.tsx` | Confirmation dialogs, modal forms |
| Dropdown Menu | `ui/dropdown-menu.tsx` | User menu, action menus |
| Input | `ui/input.tsx` | Form fields |
| Label | `ui/label.tsx` | Form field labels |
| Select | `ui/select.tsx` | Dropdown selects |
| Separator | `ui/separator.tsx` | Visual dividers |
| Sheet | `ui/sheet.tsx` | Mobile navigation drawer |
| Sonner | `ui/sonner.tsx` | Toast notifications |
| Table | `ui/table.tsx` | Data tables |
| Textarea | `ui/textarea.tsx` | Multi-line text input |
| Checkbox | `ui/checkbox.tsx` | Multiple selection |
| Switch | `ui/switch.tsx` | Toggle controls |
| Tabs | `ui/tabs.tsx` | Tabbed content panels |

---

## Important: No `asChild` Prop

shadcn/ui v5 uses @base-ui/react, which does **not** support the `asChild` prop from Radix. If you need to render a custom element inside a component, use the `render` prop instead:

```tsx
// Correct (shadcn/ui v5)
<Button render={<a href="/somewhere" />}>Click me</Button>

// Incorrect (Radix pattern, does not work)
<Button asChild><a href="/somewhere">Click me</a></Button>
```

---

## Theming

### CSS Variables

The design system uses CSS custom properties (variables) defined in `src/app/globals.css`. These control colors, spacing, border radius, and other visual properties:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0.085 232.4);      /* Indigo */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);  /* Red */
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  /* ... additional variables ... */
}
```

### Dark Mode

CSS variables include dark mode variants using the `.dark` class:

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark variants ... */
}
```

Dark mode is supported through Tailwind's `dark:` variant. The theme can be toggled by adding or removing the `dark` class on the root element.

---

## Layout Components

### Sidebar

The sidebar (`src/components/layout/sidebar.tsx`) provides the primary navigation. It is collapsible on desktop and replaced by a sheet-based drawer on mobile.

Navigation items are defined as data in `src/config/navigation.ts`:

```typescript
export const mainNavItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Nodes", href: "/nodes", icon: Server },
  // ...
];

export const managementNavItems = [
  { title: "Users", href: "/users", icon: Users, roles: ["admin"] },
  { title: "Audit Log", href: "/audit", icon: FileText, roles: ["admin"] },
  // ...
];
```

The `roles` array controls visibility based on the user's role. Items without a `roles` array are visible to all authenticated users.

### Header

The header (`src/components/layout/header.tsx`) displays:

- Mobile navigation toggle button (visible on small screens).
- User avatar and dropdown menu (profile, logout).

### Mobile Navigation

On screens narrower than the `lg` breakpoint (1024px), the sidebar is replaced by a sheet-based drawer triggered by the hamburger button in the header.

---

## Application Components

### Stat Card

The stat card (`src/components/dashboard/stat-card.tsx`) displays a single metric:

- Icon (from Lucide React).
- Label text.
- Value (number or string).

Used on the dashboard overview for fleet statistics (total nodes, online, offline, degraded).

### Node Card

The node card (`src/components/dashboard/node-card.tsx`) displays a registered BNG node:

- Node name and location.
- Status badge (color-coded).
- Last seen timestamp.
- Link to node detail page.

### Status Badge

The status badge (`src/components/shared/status-badge.tsx`) renders a color-coded badge:

| Status | Color |
|--------|-------|
| Online | Green |
| Offline | Red |
| Degraded | Yellow |
| Unknown | Gray |

### Confirm Dialog

The confirm dialog (`src/components/shared/confirm-dialog.tsx`) wraps destructive actions with a confirmation step. It displays:

- Action description.
- Warning text.
- Cancel and confirm buttons.
- The confirm button uses the `destructive` variant (red).

### Loading Skeleton

The loading skeleton (`src/components/shared/loading-skeleton.tsx`) provides animated placeholder content displayed while data is being fetched. Used in `loading.tsx` files for each page route.

---

## Form Patterns

Forms use React Hook Form with Zod validation:

```typescript
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(4, "Minimum 4 characters"),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { name: "", email: "", password: "" },
});
```

### Mutation Buttons

All buttons that trigger mutations (create, update, delete) display a loading spinner while the operation is in progress. The button is disabled during the mutation to prevent double-submission:

```tsx
<Button type="submit" disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Save
</Button>
```

### Toast Notifications

All mutations display a toast notification on completion using Sonner:

- **Success:** Green toast with a success message.
- **Error:** Red toast with an error message (including server-provided detail when available).
- **Validation error:** Toast showing the first validation error from the Zod schema.

---

## Responsive Design

dawu-manager uses a mobile-first responsive approach:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Default | < 640px | Single column, sheet navigation, stacked cards |
| `sm` | 640px+ | Minor spacing adjustments |
| `md` | 768px+ | Two-column grids where appropriate |
| `lg` | 1024px+ | Sidebar navigation visible, wider content area |
| `xl` | 1280px+ | Maximum content width |

---

## Accessibility

shadcn/ui components are built on @base-ui/react, which provides:

- Keyboard navigation for all interactive elements.
- ARIA attributes for screen readers.
- Focus management for dialogs and menus.
- Color contrast ratios meeting WCAG 2.1 AA standards.

Additional accessibility measures in dawu-manager:

- All form inputs have associated labels.
- Destructive actions require explicit confirmation.
- Status badges use both color and text to convey information (not color alone).
- Interactive elements have visible focus indicators.
