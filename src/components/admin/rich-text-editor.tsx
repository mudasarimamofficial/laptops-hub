"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Underline } from "@tiptap/extension-underline";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

type Props = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

const CALLOUT_HTML =
  '<aside data-lh-block="callout" style="padding:14px 16px;border-left:4px solid #1748B5;background:#eef3ff;border-radius:8px;margin:16px 0"><p><strong>Tip:</strong> Add your callout text here.</p></aside>';

/**
 * TipTap-backed blog body editor.
 * Replaces document.execCommand for reliable selection, undo/redo, lists and links.
 * HTML is sanitised again on the server before save. Existing post HTML loads as content.
 */
export function RichTextEditor({ value, onChange, label = "Body" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const applyingExternal = useRef(false);
  const lastEmitted = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
        autolink: true,
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { loading: "lazy" },
      }),
      Placeholder.configure({ placeholder: "Write your article…" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[var(--adm-focus)] prose-admin",
        "data-testid": "blog-rich-editor",
        "aria-label": label,
      },
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain");
        const html = event.clipboardData?.getData("text/html");
        if (html && /mso-|urn:schemas-microsoft|docs-internal/i.test(html) && text) {
          event.preventDefault();
          const cleaned = text
            .split(/\n{2,}/)
            .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
          editorRef.current?.commands.insertContent(cleaned);
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    onUpdate: ({ editor: ed }) => {
      if (applyingExternal.current) return;
      const html = ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync when parent replaces body (template apply / revision restore).
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    applyingExternal.current = true;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    lastEmitted.current = value;
    applyingExternal.current = false;
  }, [editor, value]);

  const btn =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--adm-radius-sm)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 text-xs font-semibold text-[var(--adm-ink)] hover:border-[var(--adm-action)] disabled:opacity-40";
  const active = "border-[var(--adm-action)] bg-[var(--adm-info-bg)] text-[var(--adm-action)]";

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://…)", prev || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  async function uploadInlineImage(file: File) {
    if (!editor) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("alt", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      editor.chain().focus().setImage({ src: data.url as string, alt: (data.alt as string) || "" }).run();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!editor) {
    return (
      <div className="space-y-2">
        <span className="block text-sm font-medium text-[var(--adm-ink)]">{label}</span>
        <div className="min-h-[280px] animate-pulse rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)]" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--adm-ink)]">{label}</span>
      <div
        className="flex flex-wrap gap-1 rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-1.5"
        role="toolbar"
        aria-label="Formatting"
      >
        <button type="button" className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`} title="Heading" aria-label="Heading" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" className={`${btn} ${editor.isActive("paragraph") ? active : ""}`} title="Paragraph" aria-label="Paragraph" onClick={() => editor.chain().focus().setParagraph().run()}>
          ¶
        </button>
        <button type="button" className={`${btn} ${editor.isActive("bold") ? active : ""}`} title="Bold" aria-label="Bold" aria-pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" className={`${btn} ${editor.isActive("italic") ? active : ""}`} title="Italic" aria-label="Italic" aria-pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button type="button" className={`${btn} ${editor.isActive("underline") ? active : ""}`} title="Underline" aria-label="Underline" aria-pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </button>
        <button type="button" className={`${btn} ${editor.isActive("bulletList") ? active : ""}`} title="Bulleted list" aria-label="Bulleted list" aria-pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </button>
        <button type="button" className={`${btn} ${editor.isActive("orderedList") ? active : ""}`} title="Numbered list" aria-label="Numbered list" aria-pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </button>
        <button type="button" className={`${btn} ${editor.isActive("blockquote") ? active : ""}`} title="Quote" aria-label="Quote" aria-pressed={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          “
        </button>
        <button type="button" className={`${btn} ${editor.isActive("link") ? active : ""}`} title="Link" aria-label="Link" aria-pressed={editor.isActive("link")} onClick={setLink}>
          Link
        </button>
        <button
          type="button"
          className={btn}
          title="Image from URL"
          aria-label="Image from URL"
          onClick={() => {
            const url = window.prompt("Image URL (https://…)");
            if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
          }}
        >
          Img
        </button>
        <button type="button" className={btn} title="Upload image" aria-label="Upload image" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadInlineImage(f);
          }}
        />
        <button type="button" className={btn} title="Divider" aria-label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </button>
        <button type="button" className={btn} title="Callout" aria-label="Callout" onClick={() => editor.chain().focus().insertContent(CALLOUT_HTML).run()}>
          Tip
        </button>
        <button type="button" className={btn} title="Clear formatting" aria-label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          ⌧
        </button>
        <button type="button" className={btn} title="Undo" aria-label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </button>
        <button type="button" className={btn} title="Redo" aria-label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </button>
      </div>
      {uploadErr ? (
        <p role="alert" className="text-xs text-[var(--adm-danger)]">
          {uploadErr}
        </p>
      ) : null}
      <EditorContent editor={editor} />
      <p className="text-xs text-[var(--adm-ink-2)]">
        Write visually — no HTML required. Paste from Word is cleaned when messy. Advanced HTML source remains below for rare fixes.
      </p>
    </div>
  );
}

export const BLOG_TEMPLATES: { key: string; label: string; bodyHtml: string; excerpt: string }[] = [
  {
    key: "standard",
    label: "Standard article",
    excerpt: "A clear guide for laptop shoppers.",
    bodyHtml:
      "<h2>Introduction</h2><p>Start with the problem your reader is trying to solve.</p><h2>Key points</h2><ul><li>Point one</li><li>Point two</li></ul><h2>Next step</h2><p>Invite the reader to browse matching products.</p>",
  },
  {
    key: "buying-guide",
    label: "Laptop buying guide",
    excerpt: "How to choose the right laptop for your needs.",
    bodyHtml:
      '<h2>Who this guide is for</h2><p>Students, professionals, or creators — be specific.</p><h2>What matters most</h2><ul><li>Processor generation</li><li>RAM</li><li>Storage</li><li>Display</li></ul><h2>Recommended next step</h2><p><a href="/collections/all">Browse current listings</a></p>',
  },
  {
    key: "product-review",
    label: "Product review",
    excerpt: "Hands-on notes about a specific laptop line.",
    bodyHtml: "<h2>Overview</h2><p>Describe the model line without inventing specs.</p><h2>Who it suits</h2><p></p><h2>Trade-offs</h2><p></p><h2>Verdict</h2><p></p>",
  },
  {
    key: "comparison",
    label: "Comparison article",
    excerpt: "Compare two laptop options side by side.",
    bodyHtml:
      "<h2>At a glance</h2><table><thead><tr><th>Feature</th><th>Option A</th><th>Option B</th></tr></thead><tbody><tr><td>Best for</td><td></td><td></td></tr><tr><td>RAM</td><td></td><td></td></tr></tbody></table><h2>Which should you choose?</h2><p></p>",
  },
  {
    key: "howto",
    label: "How-to / tutorial",
    excerpt: "Step-by-step instructions for a practical task.",
    bodyHtml: "<h2>Before you start</h2><p></p><h2>Steps</h2><ol><li>Step one</li><li>Step two</li><li>Step three</li></ol><h2>If something goes wrong</h2><p></p>",
  },
  {
    key: "news",
    label: "News or announcement",
    excerpt: "Store news customers should know.",
    bodyHtml: '<h2>What’s new</h2><p></p><h2>What it means for you</h2><p></p><h2>Questions?</h2><p><a href="/contact">Contact Laptops HUB</a></p>',
  },
];
