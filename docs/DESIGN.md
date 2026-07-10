# dawu-manager Design System

Single source of truth for the v2 redesign. All UI work MUST follow this.

## Stack (do not change)

Next.js 16 App Router (params are Promises — always `await params`), React 19,
Tailwind CSS v4 (CSS-first config in `globals.css`), shadcn/ui v5 on
`@base-ui/react` (NO `asChild` — use `render` prop), TanStack Query v5,
TanStack Table v8, Apache ECharts (`echarts-for-react`), Framer Motion
(`motion/react`), Sonner, Zod v4, lucide-react.

## Typography

| Use | Font | CSS | Weights |
|-----|------|-----|---------|
| h1–h3 | Plus Jakarta Sans | `font-heading` (auto via base layer) | 600/700/800 |
| Body | Inter | `font-sans` (default) | 400/500/600 |
| Code/terminal/config | JetBrains Mono | `font-mono` | 400/700 |

Fonts load via `next/font/google` in `src/app/layout.tsx` — never add `<link>` tags.
`h1`–`h6` automatically get the heading font from `globals.css` base layer.

## Color tokens (use semantic tokens ONLY — never raw hex in components)

`bg-background` `bg-card` (surface) `border-border` `text-foreground`
`text-muted-foreground` `bg-primary` (#6366F1 indigo) `text-success` (#22C55E)
`text-warning` (#F59E0B) `text-destructive` (#EF4444) `bg-accent` `ring-ring`.
Dark is the design default; light fully supported. Both defined in `globals.css`.
Charts: `--chart-1` (indigo) download, `--chart-2` (emerald) upload.

## Responsive breakpoints (MUST work at all of these)

- `<768px` — single column, bottom nav (5 icons), tables become card lists, sidebar hidden
- `768–1023px` (md) — sidebar as overlay drawer, 2-col grid, tables scroll horizontally
- `1024px+` (lg) — fixed sidebar 260px (`lg:w-[260px] lg:pl-[260px]`), full tables
- `1440px+` — content `max-w-[1600px] mx-auto`

## Utility classes (defined in globals.css)

- `.skeleton-shimmer` — skeleton loading block (shimmer 1.5s, subtle blur)
- `.content-fade-in` — 300ms fade for content replacing a skeleton
- `.card-glow` — hover border glow accent (node cards, interactive cards)
- `.press-scale` — button press scale(0.97) feedback
- Animations: `animate-shimmer`, `animate-led-pulse`, `animate-fade-in`, `animate-slide-up`

## Mandatory UX patterns

1. **Every data fetch** → skeleton placeholder sized to match final content
   (stat tile `h-24 rounded-xl`, table row `h-12` ×10, chart `aspect-video`),
   then `.content-fade-in` on the real content. Zero layout shift.
2. **Every mutation button** → disabled + `<Loader2 className="animate-spin" />` +
   progressive label ("Save" → "Saving…"). React Query `useMutation`.
3. **Every operation outcome** → Sonner toast, 5s auto-close
   (`toast.success/error/warning/info`). Errors include actionable message.
4. **Destructive actions** → `ConfirmDialog` (exists in `components/shared`).
5. **Every page** → breadcrumbs (`components/layout/breadcrumbs.tsx`) + bookmarkable URL.
6. **Error handling** → per-section error states with retry button; never blank pages;
   map 401/403/404/429/500 to human messages.
7. **Empty states** → icon + "No data yet" + CTA button.
8. **Accessibility** — semantic HTML, `aria-label` on icon buttons, focus-visible rings,
   keyboard navigable.

## Data flow (security-critical)

Browser → Next.js BFF proxy (`/api/nodes/[nodeId]/proxy/[...path]`) → dawos-agent.
NEVER call a node URL from the client. API keys decrypt server-side only.
Client hooks: `useNodeProxy(nodeId, path)` (query) and
`useNodeProxyMutation(nodeId)` in `src/hooks/use-node-proxy.ts`.
Streaming: `/api/nodes/[nodeId]/stream/[...path]` SSE passthrough
+ `useNodeSSE` hook in `src/hooks/use-node-sse.ts`.

## Shared components (import, don't reinvent)

- `components/shared/skeleton-blocks.tsx` — `SkeletonTile`, `SkeletonTable`, `SkeletonChart`, `SkeletonText`
- `components/shared/spinner-button.tsx` — `SpinnerButton` (mutation button pattern)
- `components/shared/data-table.tsx` — TanStack Table wrapper (sort, select, skeleton/empty/error states, mobile card fallback)
- `components/shared/empty-state.tsx`, `components/shared/error-state.tsx`
- `components/shared/status-badge.tsx` — online/offline/degraded/unknown
- `components/dashboard/stat-card.tsx` — big number (heading font) + trend % + sparkline
- `components/dashboard/node-card.tsx` — LED pulse status, CPU/RAM bars, session badge, sparkline, `.card-glow`
- `components/charts/traffic-chart.tsx` — ECharts real-time line (client only, dynamic import)
- `components/layout/breadcrumbs.tsx`, `components/layout/bottom-nav.tsx`, `components/command-palette.tsx`

## Testing rules

- Vitest + RTL + happy-dom, 100% coverage enforced (`vitest.config.ts` exclusions list).
- `vi.hoisted()` for all mock vars; UI primitives mocked in `src/__tests__/ui-mocks.tsx`.
- Heavy visual/chart components (`components/charts/**`) are coverage-excluded but must
  still have smoke tests where feasible.
- Every new page/component/hook ships with tests. Keep `pnpm test` green.

## Language

UI copy: English. Code/comments/commits: English. (i18n structure comes later.)
