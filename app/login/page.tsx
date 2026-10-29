import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Log in — noty",
  description: "Log in to your noty account.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in"
      description="Pick up where you left off. Use your username or email."
      footer={
        <>
          New to noty?{" "}
          <Link
            href="/register"
            className="font-medium text-primary-strong underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
