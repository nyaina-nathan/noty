import type { Metadata } from "next";
import { TagsView } from "@/components/dashboard/tags-view";

export const metadata: Metadata = {
  title: "Tags — noty",
  description: "Create and manage tags for your projects.",
};

export default function TagsPage() {
  return <TagsView />;
}
