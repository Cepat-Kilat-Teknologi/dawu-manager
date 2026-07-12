# Testing Guide

dawu-manager has a comprehensive test suite covering all components, API routes, and library functions. This guide documents the testing infrastructure, patterns, and conventions used throughout the project.

---

## Test Infrastructure

| Component | Choice | Version |
|-----------|--------|---------|
| Test framework | Vitest | 4.1.10 |
| DOM environment | happy-dom | Latest |
| Component testing | React Testing Library | Latest |
| Coverage | V8 (built into Vitest) | -- |
| Configuration | `vitest.config.ts` | -- |

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run a specific test file
pnpm test src/__tests__/api/nodes.test.ts

# Run tests matching a pattern
pnpm test --grep "health check"
```

---

## Test File Organization

All test files are located in `src/__tests__/` and mirror the `src/` directory structure:

```
src/__tests__/
  setup.ts                    # Global test setup
  ui-mocks.tsx                # shadcn/ui component mocks
  api/                        # API route tests
    nodes.test.ts
    nodes-nodeId.test.ts
    nodes-health.test.ts
    nodes-proxy.test.ts
    setup.test.ts
    fleet-operations.test.ts
    users.test.ts
    audit.test.ts
    alerts.test.ts
  components/                 # Component tests
    sidebar.test.tsx
    header.test.tsx
    mobile-nav.test.tsx
    stat-card.test.tsx
    node-card.test.tsx
    status-badge.test.tsx
    confirm-dialog.test.tsx
    loading-skeleton.test.tsx
    providers.test.tsx
    operations-manager.test.tsx
  config/                     # Configuration tests
    navigation.test.ts
  lib/                        # Library tests
    auth-guard.test.ts
    crypto.test.ts
    dawos-client.test.ts
    utils.test.ts
    constants.test.ts
  pages/                      # Page component tests
    dashboard.test.tsx
    login.test.tsx
    setup.test.tsx
    nodes-list.test.tsx
    nodes-new.test.tsx
    node-detail.test.tsx
    node-sessions.test.tsx
    node-firewall.test.tsx
    node-network.test.tsx
    node-config.test.tsx
    node-traffic.test.tsx
    node-service.test.tsx
    node-pppoe.test.tsx
    node-routing.test.tsx
    node-ip-pool.test.tsx
    operations.test.tsx
```

---

## Coverage Configuration

Coverage thresholds are defined in `vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  exclude: [
    "src/components/ui/**",     // shadcn/ui primitives
    "src/app/layout.tsx",       // Root layout (providers wrapper)
    "src/app/api/auth/**",      // NextAuth route handler
    "src/lib/auth.ts",          // NextAuth config
    "src/lib/db.ts",            // Prisma singleton
  ],
}
```

### Coverage Exclusions

| Path | Reason |
|------|--------|
| `src/components/ui/**` | Third-party shadcn/ui components; tested by the library |
| `src/app/layout.tsx` | Root layout is a thin wrapper around providers |
| `src/app/api/auth/**` | NextAuth handler is a re-export of the auth configuration |
| `src/lib/auth.ts` | NextAuth configuration; behavior is tested through auth-guard tests |
| `src/lib/db.ts` | Prisma singleton; mocked in all tests |

---

## Test Setup

The global test setup file (`src/__tests__/setup.ts`) runs before every test and configures:

- React Testing Library auto-cleanup after each test.
- Global mocks for `next/navigation` (useRouter, usePathname, useSearchParams).
- Global mocks for `next-auth/react` (useSession, signIn, signOut).
- Global mock for `sonner` (toast notifications).

---

## Testing Patterns

### API Route Tests

API routes are tested by calling the exported handler function with a mock `Request` object:

```typescript
import { GET, POST } from "@/app/api/nodes/route";

describe("GET /api/nodes", () => {
  it("returns node list for authenticated user", async () => {
    mockRequireAuth.mockResolvedValue({ id: "user1", role: "admin" });
    mockPrisma.node.findMany.mockResolvedValue([mockNode]);

    const response = await GET(new Request("http://localhost/api/nodes"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("test-node");
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthError());

    const response = await GET(new Request("http://localhost/api/nodes"));
    expect(response.status).toBe(401);
  });
});
```

### Server Component Tests

Server components in Next.js are async functions. Test them by calling the function and rendering the returned JSX:

```typescript
import Page from "@/app/(dashboard)/page";

it("renders the dashboard", async () => {
  mockRequireAuth.mockResolvedValue(mockUser);
  mockPrisma.node.findMany.mockResolvedValue([mockNode]);

  const jsx = await Page();
  const { getByText } = render(jsx);

  expect(getByText("Overview")).toBeInTheDocument();
});
```

### Client Component Tests

Client components are tested with standard React Testing Library:

```typescript
import { NodeCard } from "@/components/dashboard/node-card";

it("displays node name and status", () => {
  const { getByText } = render(
    <NodeCard node={mockNode} />
  );

  expect(getByText("bng-jakarta-dc1-01")).toBeInTheDocument();
  expect(getByText("Online")).toBeInTheDocument();
});
```

### TanStack Query in Tests

Components that use TanStack Query hooks need a `QueryClientProvider` wrapper:

```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

it("fetches and displays data", async () => {
  const { getByText } = render(<MyComponent />, {
    wrapper: createWrapper(),
  });
  // ...
});
```

Create a fresh `QueryClient` per test to prevent cached data from leaking between tests.

### Mocking with vi.hoisted()

Variables used inside `vi.mock()` factory functions must be created with `vi.hoisted()`:

```typescript
const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    node: {
      findMany: vi.fn(),
      create: vi.fn(),
      // ...
    },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
```

This ensures the mock variables exist before the module-level mock factories execute.

### Testing redirect() and notFound()

Next.js uses `throw` to implement `redirect()` and `notFound()`. In tests, mock these functions to also throw:

```typescript
class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new RedirectError(url); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

it("redirects unauthenticated users to login", async () => {
  mockRequireAuth.mockRejectedValue(new RedirectError("/login"));

  await expect(Page()).rejects.toThrow("REDIRECT:/login");
});
```

---

## shadcn/ui Component Mocks

The `src/__tests__/ui-mocks.tsx` file provides mock implementations for all shadcn/ui components used in the project. These mocks render simplified HTML elements that can be queried with Testing Library:

```typescript
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>,
  CardContent: ({ children }) => <div>{children}</div>,
}));
```

---

## Writing New Tests

When adding a new feature:

1. Create a test file in the appropriate `src/__tests__/` subdirectory.
2. Import the module under test and its dependencies.
3. Create hoisted mock variables for all dependencies.
4. Write test cases covering:
   - Happy path (successful operation).
   - Authentication failure.
   - Authorization failure (wrong role).
   - Validation failure (invalid input).
   - Edge cases (empty data, missing fields, network errors).
5. Run `pnpm test:coverage` to check coverage for your changes.
6. Add tests for any uncovered lines in your new code.
