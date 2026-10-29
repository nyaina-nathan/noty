import type { Metadata } from "next";
import { NotesView } from "@/components/dashboard/notes-view";

export const metadata: Metadata = {
  title: "Notes — noty",
  description: "Create, search, and organize your notes.",
};

export default function NotesPage() {
  return <NotesView />;
}
