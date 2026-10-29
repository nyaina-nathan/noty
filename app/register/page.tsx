import type { Metadata } from "next";
import { AuthPlaceholder } from "@/components/auth-placeholder";

export const metadata: Metadata = {
  title: "Create account — noty",
  description: "Create your free noty account.",
};

export default function RegisterPage() {
  return (
    <AuthPlaceholder
      eyebrow="Coming soon"
      title="Create your free account"
      description="The sign-up screen is still being built. The account API is ready — this page is a placeholder until the form ships."
      primaryHref="/login"
      primaryLabel="Log in instead"
      secondaryHref="/"
      secondaryLabel="Back to home"
    />
  );
}
