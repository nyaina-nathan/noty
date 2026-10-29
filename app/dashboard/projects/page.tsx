import type { Metadata } from "next";
import { ProjectsView } from "@/components/dashboard/projects-view";

export const metadata: Metadata = {
  title: "Projects — noty",
  description: "Group related notes into projects and tags.",
};

export default function ProjectsPage() {
  return <ProjectsView />;
}
