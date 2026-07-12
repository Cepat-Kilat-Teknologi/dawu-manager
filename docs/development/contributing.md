# Contributing

Thank you for your interest in contributing to dawu-manager. This guide covers the development workflow, coding standards, and submission process.

---

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 or later | Runtime |
| pnpm | 10.x | Package manager |
| Git | Any recent version | Version control |

### Clone and Install

```bash
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager
pnpm install
```

### Initialize the Database

```bash
pnpm exec prisma migrate dev
```

### Start the Development Server

```bash
pnpm dev
```

The development server starts on [http://localhost:3789](http://localhost:3789) with Turbopack for fast module resolution.

---

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
  components/       # React components (ui/, layout/, dashboard/, shared/)
  lib/              # Core libraries (auth, crypto, database, HTTP client)
  config/           # Data-driven configuration
  hooks/            # React hooks (TanStack Query wrappers)
  types/            # TypeScript type definitions
  __tests__/        # All test files (mirrors src/ structure)
```

For a detailed breakdown of every directory and file, see [Architecture Overview](../architecture/overview.md).

---

## Coding Standards

### TypeScript

- Strict mode enabled (`tsconfig.json`).
- Type annotations required on all function signatures.
- No `any` types except in test mocks where unavoidable.
- Use `interface` for object shapes, `type` for unions and intersections.

### Code Style

- **Formatting:** Enforced by ESLint. Run `pnpm lint` before committing.
- **Imports:** Use path aliases (`@/`) for project imports. Group imports: external packages first, then internal modules.
- **Naming:** camelCase for variables and functions, PascalCase for components and types, UPPER_SNAKE_CASE for constants.
- **Comments:** Write comments that explain "why," not "what." Self-documenting code is preferred over excessive comments.

### React Conventions

- Use server components by default. Add `"use client"` only when the component needs browser APIs, event handlers, or React hooks.
- Keep server components for data fetching and layout; delegate interactivity to client components.
- Use the `render` prop (not `asChild`) for custom element rendering in shadcn/ui v5 components.

### API Routes

- Validate all request bodies with Zod schemas.
- Use `requireAuth()` with the minimum required role.
- Return consistent error responses: `{ error: string, detail?: string }`.
- Create audit log entries for all mutation operations.

---

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run a specific test file
pnpm test src/__tests__/api/nodes.test.ts
```

### Coverage

The project maintains a comprehensive test suite. When contributing, please include tests for new features or bug fixes. Run `pnpm test:coverage` to generate a coverage report and check which lines your changes affect.

### Test Patterns

| Component Type | Test Pattern |
|----------------|-------------|
| API routes | Call the route handler function with mock `Request` objects |
| Server components | Call the async page function, render the returned JSX |
| Client components | Standard React Testing Library `render()` + `fireEvent` |
| Libraries | Direct function calls with mock dependencies |

### Important Testing Conventions

- **`vi.hoisted()`** -- Variables used inside `vi.mock()` factory functions must be created with `vi.hoisted()`.
- **`redirect()` and `notFound()`** -- These Next.js functions throw to halt execution. Mocks must also throw.
- **Login page testing** -- Mock `fetch` (not `signIn`), expecting two calls: CSRF token request + credentials callback.

---

## Git Workflow

### Branch Naming

```
feature/short-description
fix/short-description
docs/short-description
refactor/short-description
```

### Commit Messages

Use conventional commit format:

```
feat: add bulk session termination endpoint
fix: correct firewall group creation escaping
docs: update deployment guide for Docker
refactor: extract proxy logic into dawos-client module
test: add coverage for fleet operations API
chore: update dependencies
```

### Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes with tests.
3. Verify all quality gates pass: `pnpm lint && pnpm test:coverage && pnpm build`.
4. Push your branch and open a pull request.
5. Describe the change, motivation, and testing approach in the PR description.
6. Address review feedback.

---

## Quality Gates

Before submitting a pull request, verify all gates pass:

```bash
# Lint check
pnpm lint

# Test with coverage
pnpm test:coverage

# Production build
pnpm build
```

All three commands must complete without errors.

| Gate | Command | Requirement |
|------|---------|-------------|
| Lint | `pnpm lint` | Zero errors |
| Tests | `pnpm test` | All tests passing |
| Coverage | `pnpm test:coverage` | No significant drops |
| Build | `pnpm build` | Successful production build |

---

## Adding a New Node Feature Page

To add a new feature page for a node (e.g., a new dawos-agent endpoint category):

1. **Add the navigation item** in `src/config/navigation.ts`:

    ```typescript
    { title: "New Feature", href: "/new-feature", icon: SomeIcon },
    ```

2. **Create the page** at `src/app/(dashboard)/nodes/[nodeId]/new-feature/page.tsx`.

3. **Create the client component** (if interactive) in `src/components/`.

4. **Write tests** for the page, component, and any new API routes.

5. **Update documentation** if the feature changes user-facing behavior.

---

## Adding a New API Route

1. **Create the route handler** in `src/app/api/`.

2. **Add Zod validation** for request bodies.

3. **Add auth guard** with appropriate role requirement.

4. **Add audit logging** for mutation operations.

5. **Write tests** covering:
   - Successful operation.
   - Authentication failure (no session).
   - Authorization failure (insufficient role).
   - Validation failure (invalid request body).
   - Edge cases specific to the endpoint.

---

## Database Schema Changes

1. Modify `prisma/schema.prisma`.
2. Create a migration: `pnpm exec prisma migrate dev --name description`.
3. Update TypeScript types if needed.
4. Update relevant tests.
5. Include the migration file in your commit.

---

## Reporting Issues

When reporting a bug, include:

- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Environment details (OS, Node.js version, browser).
- Relevant log output.

---

## License

dawu-manager is released under the [MIT License](https://github.com/Cepat-Kilat-Teknologi/dawu-manager/blob/main/LICENSE). By contributing, you agree that your contributions will be licensed under the same license.
