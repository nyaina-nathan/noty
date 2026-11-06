"use client";

import { type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  EraserIcon,
  ItalicIcon,
  OrderedListIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from "./icons";

const FONT_SIZES = ["14px", "16px", "18px", "20px", "24px", "30px"];

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  toggle?: boolean;
};

function ToolbarButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  toggle = false,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-primary/10 text-primary-strong"
          : "text-muted hover:bg-mist hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />;
}

const selectClass =
  "h-8 rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink transition-colors hover:bg-mist focus:outline-none";

export function NoteEditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const fontSize = current.getAttributes("textStyle").fontSize;
      const block = current.isActive("heading", { level: 1 })
        ? "h1"
        : current.isActive("heading", { level: 2 })
          ? "h2"
          : current.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph";

      return {
        block,
        fontSize: typeof fontSize === "string" ? fontSize : "",
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        strike: current.isActive("strike"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        blockquote: current.isActive("blockquote"),
        codeBlock: current.isActive("codeBlock"),
        canUndo: current.can().chain().focus().undo().run(),
        canRedo: current.can().chain().focus().redo().run(),
      };
    },
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-line bg-mist/50 px-2 py-1.5"
    >
      <ToolbarButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <UndoIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <RedoIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <select
        aria-label="Text style"
        value={state.block}
        onChange={(event) => {
          const value = event.target.value;
          const chain = editor.chain().focus();

          if (value === "paragraph") {
            chain.setParagraph().run();
            return;
          }

          const level = Number(value.slice(1)) as 1 | 2 | 3;
          chain.setHeading({ level }).run();
        }}
        className={selectClass}
      >
        <option value="paragraph">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <select
        aria-label="Font size"
        value={state.fontSize}
        onChange={(event) => {
          const value = event.target.value;
          const chain = editor.chain().focus();

          if (value) {
            chain.setFontSize(value).run();
          } else {
            chain.unsetFontSize().run();
          }
        }}
        className={selectClass}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>

      <Divider />

      <ToolbarButton
        label="Bold"
        toggle
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        toggle
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        toggle
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        toggle
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        toggle
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        toggle
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <OrderedListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        toggle
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        toggle
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeBlockIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <EraserIcon className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
