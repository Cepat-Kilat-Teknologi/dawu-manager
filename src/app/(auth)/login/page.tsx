"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loginWithCredentials } from "@/lib/auth-client";
import { FormAlert } from "@/components/shared/form-alert";
import { AppLogo } from "@/components/shared/app-logo";

/**
 * Login page component.
 * Renders an email/password form that authenticates via NextAuth credentials provider.
 * Delegates authentication to `loginWithCredentials()` utility for testability.
 * Displays toast notifications on success/failure and redirects to the dashboard on login.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Handle login form submission — delegates to loginWithCredentials utility.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginWithCredentials(email, password);

      if (!result.ok) {
        setError(result.error ?? "Invalid email or password.");
        toast.error("Login failed", {
          description: result.error ?? "Invalid email or password.",
        });
      } else {
        toast.success("Welcome back!", {
          description: "Redirecting to dashboard...",
        });
        // Full navigation (not router.push) so the SessionProvider cache is
        // re-primed — client-side nav keeps the stale null session and hides
        // the header user menu until a manual reload.
        window.location.assign("/");
        return;
      }
    } catch {
      setError("An unexpected error occurred.");
      toast.error("Login error", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full rounded-2xl border-border/70 bg-card/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="lg:hidden">
          <AppLogo />
        </div>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormAlert message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              className="h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="press-scale h-11 w-full shadow-lg shadow-primary/25"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Node API keys stay encrypted on the server — never in your browser.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
