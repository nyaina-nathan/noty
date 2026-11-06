"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { requestJson } from "@/lib/api/client";
import { noteDocumentsEqual } from "@/lib/note-content";
import type { NoteDetail, NoteDocument } from "@/types/note.types";
import { describeFailure } from "./hooks";
import { NoteEditorToolbar } from "./note-editor-toolbar";

const AUTOSAVE_DELAY = 800;

type SaveStatus = "idle" | "saving" | "dirty" | "saved" | "error";

type NoteEditorProps = {
  note: NoteDetail;
  onSaved: (note: NoteDetail) => void;
};

export function NoteEditor({ note, onSaved }: NoteEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const draftRef = useRef<NoteDocument>(note.content);
  const savedRef = useRef<NoteDocument>(note.content);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const updateDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
      }),
      TextStyle,
      FontSize,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: note.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "note-prose min-h-[18rem] focus:outline-none",
        "aria-label": "Note content",
      },
    },
    onCreate: ({ editor }) => {
      const document = editor.getJSON() as NoteDocument;

      draftRef.current = document;
      savedRef.current = document;
      setStatus("saved");
      updateDirty(false);
    },
    onUpdate: ({ editor }) => {
      draftRef.current = editor.getJSON() as NoteDocument;
      setStatus("dirty");
      updateDirty(true);
      setRevision((current) => current + 1);
    },
  });

  const saveNow = useCallback(
    async (options?: { keepalive?: boolean }) => {
      if (inFlightRef.current) {
        queuedRef.current = true;
        return;
      }

      const content = draftRef.current;

      if (noteDocumentsEqual(content, savedRef.current)) {
        setStatus("saved");
        updateDirty(false);
        return;
      }

      inFlightRef.current = true;
      queuedRef.current = false;
      setStatus("saving");
      setSaveError(null);

      const result = await requestJson<NoteDetail>(`/api/notes/${note.id}`, {
        method: "PATCH",
        body: { content },
        keepalive: options?.keepalive,
      });

      inFlightRef.current = false;

      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/login");
        }

        setStatus("error");
        setSaveError(describeFailure(result));
        updateDirty(true);
        return;
      }

      savedRef.current = result.data.content;
      onSavedRef.current(result.data);

      if (noteDocumentsEqual(draftRef.current, result.data.content)) {
        setStatus("saved");
        updateDirty(false);
        queuedRef.current = false;
        return;
      }

      setStatus("dirty");
      updateDirty(true);
      queuedRef.current = true;

      if (queuedRef.current) {
        queuedRef.current = false;
        setRevision((current) => current + 1);
      }
    },
    [note.id, router, updateDirty],
  );

  useEffect(() => {
    if (revision === 0) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [revision, saveNow]);

  useEffect(() => {
    return () => {
      if (!dirtyRef.current) {
        return;
      }

      void requestJson<NoteDetail>(`/api/notes/${note.id}`, {
        method: "PATCH",
        body: { content: draftRef.current },
        keepalive: true,
        allowRefresh: false,
      });
    };
  }, [note.id]);

  const dirty = status === "dirty" || status === "saving" || status === "error";

  useEffect(() => {
    if (!dirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    }

    window.addEventListener("keydown", handleSaveShortcut);

    return () => {
      window.removeEventListener("keydown", handleSaveShortcut);
    };
  }, [saveNow]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {editor ? <NoteEditorToolbar editor={editor} /> : null}

        <div className="note-editor px-5 py-4 sm:px-6">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="min-h-[18rem]" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-mist/40 px-4 py-2">
          <p
            className="flex items-center gap-2 text-[11px] text-muted"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                status === "error"
                  ? "bg-danger"
                  : status === "saving" || status === "dirty"
                    ? "bg-warning"
                    : "bg-success"
              }`}
            />
            {status === "saving"
              ? "Saving…"
              : status === "dirty"
                ? "Unsaved changes"
                : status === "error"
                  ? "Couldn't save"
                  : "Saved"}
          </p>

          <div className="flex items-center gap-3">
            {saveError ? (
              <p className="text-[11px] text-danger-strong" role="alert">
                {saveError}
              </p>
            ) : null}

            {status === "error" ? (
              <button
                type="button"
                onClick={() => void saveNow()}
                className="text-[11px] font-medium text-primary-strong underline-offset-2 hover:underline"
              >
                Retry
              </button>
            ) : (
              <p className="hidden font-mono text-[10px] text-muted/70 sm:block">
                Ctrl/⌘S to save
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
