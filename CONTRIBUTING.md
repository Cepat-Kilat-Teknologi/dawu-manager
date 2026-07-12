# Contributing to dawu-manager

Thank you for your interest in contributing to dawu-manager! This guide will help you
get started with the development workflow.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Architecture Notes](#architecture-notes)

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|:---------------:|-------|
| Node.js | 20.0+ | `node --version` |
| pnpm | 9.0+ | `pnpm --version` |
| Git | 2.30+ | `git --version` |

---

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Cepat-Kilat-Teknologi/dawu-manager.git
cd dawu-manager

# 2. Install dependencies
pnpm install

# 3. Set up the database
pnpm exec prisma migrate dev

# 4. Start the dev server
pnpm dev
```

The dev server starts at http://localhost:3789 with Turbopack hot-reload.

On first visit, you'll be redirected to `/setup` to create an admin account.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── (auth)/             # Public auth pages (login, setup)
│   ├── (dashboard)/        # Protected pages (sidebar layout)
│   └── api/                # API route handlers
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives (do not edit directly)
│   ├── layout/             # Sidebar, header, mobile nav
│   ├── dashboard/          # Stat cards, node cards
│   ├── fleet/              # Fleet operations components
│   ├── shared/             # Reusable: status badge, confirm dialog, skeleton
│   └── providers.tsx       # TanStack Query + Sonner Toaster
├── lib/                    # Core utilities (auth, crypto, db, proxy client)
├── hooks/                  # Custom React hooks (useNodeProxy, etc.)
├── config/                 # Data-driven navigation config
├── types/                  # TypeScript type declarations
└── __tests__/              # All test files (mirrors src/ structure)
```

Key conventions:
- **Pages** are server components; complex UI is extracted to client components
- **API routes** handle auth, RBAC, and proxy forwarding
- **Navigation** is data-driven (`src/config/navigation.ts`), not hardcoded JSX
- **shadcn/ui v5** uses `@base-ui/react` — no `asChild` prop; use `render` instead

---

## Development Workflow

### Running the dev server

```bash
pnpm dev                    # Start with Turbopack (port 3789)
```

### Database changes

```bash
pnpm exec prisma migrate dev   # Create + apply migration
pnpm exec prisma generate      # Regenerate client after schema changes
pnpm exec prisma studio        # Visual database browser
```

### Adding a shadcn/ui component

```bash
pnpm exec shadcn add <component-name>
```

Components are installed to `src/components/ui/`. Do not edit generated files directly.

---

## Code Style

### Language

- **Code, comments, docstrings, commits** — English
- **Communication** — Indonesian (for Indonesian team members)

### TypeScript

- Strict mode enabled
- All function parameters and return types must be typed
- Use Zod for runtime validation on API boundaries

### Formatting

- ESLint enforced (`pnpm lint`)
- Follow existing patterns in the codebase

### Imports

- Use `@/` path alias for all internal imports (e.g., `@/lib/auth-guard`)
- Group imports: external packages → internal modules → types

---

## Testing

### Quality gates (must all pass before merge)

| Gate | Command | Target |
|------|---------|--------|
| Tests | `pnpm test` | 1115 passing |
| Coverage | `pnpm test:coverage` | 100% (statements, branches, functions, lines) |
| Lint | `pnpm lint` | Zero errors |
| Build | `pnpm build` | Clean build (includes `tsc` type checking) |

### Quick verification

```bash
pnpm lint && pnpm test:coverage && pnpm build
```

### Test patterns

| Target | Pattern |
|--------|---------|
| API routes | Direct function call with mock `Request` objects |
| Server components | Call async function directly, render returned JSX |
| Client components | Standard RTL `render()` + `fireEvent` / `userEvent` |
| Mock variables | Create with `vi.hoisted()` before `vi.mock()` factories |
| `redirect()` / `notFound()` | Must throw (use custom Error classes in mocks) |

### Writing tests

- Test files go in `src/__tests__/` mirroring the source structure
- Use `vi.hoisted()` for any variable referenced inside `vi.mock()` factories
- Mock shadcn/ui components via `src/__tests__/ui-mocks.tsx`
- Every new component, page, or API route **must** have corresponding tests
- Coverage must remain at **100%** — CI will reject drops

### Running specific tests

```bash
pnpm test -- src/__tests__/api/nodes.test.ts          # Single test file
pnpm test -- --grep "should create node"               # By test name
pnpm test:watch -- src/__tests__/components/            # Watch a directory
```

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, config, CI) |

### Scopes (optional)

Use the feature area: `auth`, `nodes`, `proxy`, `fleet`, `alerts`, `audit`, `ui`, `db`, etc.

### Examples

```
feat(fleet): add cross-node health check fan-out
fix(proxy): handle 404 from dawos-agent gracefully
docs: update README with current test count
test(alerts): add threshold evaluation edge cases
refactor(auth): extract role check to shared utility
```

### Rules

- **One logical change per commit**
- **Squash** work-in-progress commits before requesting review
- Keep subject line under 72 characters
- Use imperative mood ("add feature" not "added feature")

---

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement your changes** following the code style and testing guidelines above

3. **Verify all quality gates pass**:
   ```bash
   pnpm lint && pnpm test:coverage && pnpm build
   ```

4. **Squash commits** into logical units with conventional commit messages

5. **Open a pull request** against `main`:
   - Title: conventional commit format (e.g., `feat(fleet): add bulk restart`)
   - Description: what changed, why, and how to test
   - Link related issues if applicable

6. **Address review feedback** — push fixup commits, squash before merge

### PR checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Coverage remains at 100% (`pnpm test:coverage`)
- [ ] Lint is clean (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] New features have corresponding tests
- [ ] Documentation updated if user-facing behavior changed
- [ ] No secrets or credentials in committed files

---

## Architecture Notes

### Proxy layer

All communication with dawos-agent BNG nodes flows through Next.js API routes.
The browser **never** directly contacts a BNG node. The proxy:

1. Validates the user's JWT session
2. Checks RBAC permissions (viewer / operator / admin)
3. Decrypts the node's stored API key
4. Forwards the request with `X-API-Key` header
5. Logs mutations to the audit trail

### API key encryption

Node API keys are encrypted at rest using AES-256-GCM with a scrypt-derived key.
See `src/lib/crypto.ts`. Never log or expose decrypted keys.

### Data-driven navigation

Sidebar items are defined as data in `src/config/navigation.ts`. To add a new page:

1. Create the page component in `src/app/(dashboard)/`
2. Add a navigation entry in `navigation.ts`
3. Add tests for the page and any new components

### RBAC

Three roles with hierarchical permissions:

| Role | Level | Can do |
|------|:-----:|--------|
| `viewer` | 0 | Read-only access |
| `operator` | 1 | + Node CRUD, proxy writes |
| `admin` | 2 | + User management, audit, settings |

Use `requireAuth("operator")` in API routes and `hasRole("operator")` in client components.

---

## Getting Help

- Read the [README](README.md) for project overview
- Read [INSTALLATION.md](INSTALLATION.md) for setup details
- Read [HOW_TO_USE.md](HOW_TO_USE.md) for usage guide
- Check `docs/` for API coverage and design documents
- Open an issue for bugs or feature requests

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
