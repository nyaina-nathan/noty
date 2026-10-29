import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Dashboard — noty",
  description: "Your noty workspace.",
};

export default function DashboardPage() {
  return (
    <AuthShell
      eyebrow="Coming soon"
      title="Your dashboard"
      description="The workspace is next. Notes, projects, and tags will all live here."
      footer={
        <Link
          href="/"
          className="font-medium text-primary-strong underline underline-offset-4"
        >
          Back to the homepage
        </Link>
      }
    />
  );
}
