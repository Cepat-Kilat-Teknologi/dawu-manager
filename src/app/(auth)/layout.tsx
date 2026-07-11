import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppLogo } from "@/components/shared/app-logo";
import { Radio, ShieldCheck, Terminal } from "lucide-react";

const FEATURES = [
  {
    icon: Radio,
    title: "Real-time visibility",
    text: "Live PPPoE sessions, traffic charts, and events streamed from every BNG node.",
  },
  {
    icon: ShieldCheck,
    title: "Keys never leave the server",
    text: "Node API keys are AES-256 encrypted and injected server-side — the browser never sees them.",
  },
  {
    icon: Terminal,
    title: "No more SSH hopping",
    text: "Firewall, routing, config checkpoints, and playbooks for the whole fleet in one dashboard.",
  },
];

/**
 * Auth layout for login and setup pages — premium split-panel design.
 * Left: brand panel with product story (hidden below lg).
 * Right: centered form panel with a subtle accent glow.
 *
 * Guard (DM-M18): If user is already authenticated, redirect to dashboard.
 * Per-page guards (setup vs login) are handled in the individual pages.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden overflow-hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between">
        {/* Dot grid + accent glow backdrop */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[size:26px_26px] opacity-60"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px]"
          aria-hidden="true"
        />

        <div className="relative">
          <AppLogo />
        </div>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl leading-tight">
              Every BNG node.
              <br />
              One dashboard.
            </h1>
            <p className="text-base text-muted-foreground">
              dawu-manager centralizes your dawos-agent fleet — sessions,
              traffic, firewall, routing, and automation without SSH.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <f.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {f.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          dawos ecosystem · dawu-manager
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-4 md:p-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative w-full max-w-sm animate-slide-up">
          {children}
        </div>
      </div>
    </div>
  );
}
