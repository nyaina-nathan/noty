import type { Metadata } from "next";
import { NoteDetailView } from "@/components/dashboard/note-detail-view";

export const metadata: Metadata = {
  title: "Note — noty",
  description: "Read and edit a note with rich-text formatting.",
};

/** The note is loaded in the browser, so this route is allowed to block. */
export const instant = false;

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;

  return <NoteDetailView noteId={noteId} />;
}
