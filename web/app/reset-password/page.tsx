"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Lock } from "lucide-react";
import { resetPassword } from "@/lib/api";
import { storeTokens, notifyAuthChanged } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UI_MESSAGES } from "@travel-board/shared";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Invalid reset link
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This password reset link is invalid or has expired.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(UI_MESSAGES.AUTH.PASSWORDS_MISMATCH);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await resetPassword(token, password);
      storeTokens(data.accessToken, data.refreshToken);
      notifyAuthChanged("login");
      setSuccess(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : UI_MESSAGES.COMMON.GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <CheckCircle className="mb-4 size-12 text-success" />
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Password reset!
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Redirecting you to the home page…
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Lock className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
