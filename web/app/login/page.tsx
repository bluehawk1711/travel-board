import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { UI_MESSAGES } from "@travel-board/shared";

export const metadata: Metadata = {
  title: "Sign in",
  description: UI_MESSAGES.AUTH.SIGN_IN_META,
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <AuthForm mode="login" />
    </main>
  );
}