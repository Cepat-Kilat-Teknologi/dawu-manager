"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        router.push("/");
        router.refresh();
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
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center space-y-2">
        <AppLogo />
        <CardTitle className="text-lg">Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormAlert message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
