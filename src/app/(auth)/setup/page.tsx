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
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { FormAlert } from "@/components/shared/form-alert";
import { AppLogo } from "@/components/shared/app-logo";

/**
 * First-run setup page.
 * Allows creating the initial administrator account when no users exist.
 * Validates password match and minimum length before submitting to POST /api/setup.
 */
export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Handle setup form submission — validates passwords and creates the admin user.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      toast.error("Validation error", { description: "Passwords do not match." });
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      toast.error("Validation error", { description: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Setup failed.");
        toast.error("Setup failed", { description: data.error || "Could not create admin account." });
        return;
      }

      toast.success("Admin account created!", { description: "Redirecting to login..." });
      // Redirect to login after successful setup
      router.push("/login");
    } catch {
      setError("An unexpected error occurred.");
      toast.error("Setup error", { description: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-2">
        <AppLogo />
        <CardTitle className="text-lg">Welcome to dawu-manager</CardTitle>
        <CardDescription>
          Create your administrator account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormAlert message={error} />
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="admin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@dawu.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={`dawu (min ${PASSWORD_MIN_LENGTH} characters)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Admin Account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
