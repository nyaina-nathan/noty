import type { Metadata } from "next";
import { ProjectDetailView } from "@/components/dashboard/project-detail-view";

export const metadata: Metadata = {
  title: "Project — noty",
  description: "Browse the notes in a project and manage its details.",
};

/** The project is loaded in the browser, so this route is allowed to block. */
export const instant = false;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectDetailView projectId={projectId} />;
}
