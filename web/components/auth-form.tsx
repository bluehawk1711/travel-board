"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { API_URL, login, signup } from "@/lib/api";
import { notifyAuthChanged, storeTokens } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UI_MESSAGES } from "@travel-board/shared";

/** Google's official brand palette — vendor-owned, not part of Terra Nova. */
const GOOGLE_BLUE = "#4285F4";
const GOOGLE_GREEN = "#34A853";
const GOOGLE_YELLOW = "#FBBC05";
const GOOGLE_RED = "#EA4335";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const authMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
    }) =>
      isSignup
        ? signup(payload.name, payload.email, payload.password)
        : login(payload.email, payload.password),
    onSuccess: (tokens) => {
      // Access token stored in memory for Socket.IO; refresh token is in an
      // httpOnly cookie set by the API.
      storeTokens(tokens.accessToken, "");
      notifyAuthChanged("login");
      router.push("/");
      router.refresh();
    },
    onError: (err: Error) => {
      setError(err.message || UI_MESSAGES.COMMON.GENERIC_ERROR);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    authMutation.mutate({ name, email, password });
  };

  const busy = authMutation.isPending;

  const continueWithGoogle = () => {
    // Backend redirects to FRONTEND_URL/auth/callback with tokens in the URL.
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {isSignup
              ? UI_MESSAGES.AUTH.JOIN_TAGLINE
              : "Sign in to continue planning trips together."}
          </p>
        </div>

        {isSignup && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
              required
              minLength={1}
              maxLength={100}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={8}
            maxLength={72}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {isSignup ? "At least 8 characters." : "8–72 characters."}
            </p>
            {!isSignup && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isSignup ? (
            <UserPlus className="size-4" />
          ) : (
            <LogIn className="size-4" />
          )}
          {isSignup ? "Create account" : "Sign in"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide text-zinc-400">
            <span className="bg-white px-2 dark:bg-zinc-900">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={continueWithGoogle}
          className="w-full"
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path
              fill={GOOGLE_BLUE}
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
            />
            <path
              fill={GOOGLE_GREEN}
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill={GOOGLE_YELLOW}
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
            />
            <path
              fill={GOOGLE_RED}
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isSignup
            ? UI_MESSAGES.AUTH.HAVE_ACCOUNT
            : UI_MESSAGES.AUTH.NEW_HERE}{" "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-primary hover:underline"
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}