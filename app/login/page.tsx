import type { Metadata } from "next";
import { AuthPlaceholder } from "@/components/auth-placeholder";

export const metadata: Metadata = {
  title: "Log in — noty",
  description: "Sign in to noty.",
};

export default function LoginPage() {
  return (
    <AuthPlaceholder
      eyebrow="Coming soon"
      title="Log in"
      description="The sign-in screen is still being built. The account API is ready — this page is a placeholder until the form ships."
      primaryHref="/register"
      primaryLabel="Create an account"
      secondaryHref="/"
      secondaryLabel="Back to home"
    />
  );
}
