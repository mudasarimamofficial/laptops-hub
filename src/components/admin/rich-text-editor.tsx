"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

type Tool = { cmd?: string; arg?: string; label: string; title: string; html?: string };

const TOOLS: Tool[] = [
  { cmd: "formatBlock", arg: "h2", label: "H2", title: "Heading" },
  { cmd: "formatBlock", arg: "p", label: "¶", title: "Paragraph" },
  { cmd: "bold", label: "B", title: "Bold" },
  { cmd: "italic", label: "I", title: "Italic" },
  { cmd: "underline", label: "U", title: "Underline" },
  { cmd: "insertUnorderedList", label: "•", title: "Bulleted list" },
  { cmd: "insertOrderedList", label: "1.", title: "Numbered list" },
  { cmd: "formatBlock", arg: "blockquote", label: "“", title: "Quote" },
];

/**
 * Visual blog body editor. Uses browser editing APIs (no new SaaS dependency).
 * HTML is sanitised again on the server before save. Icon-style compact toolbar for Admin VNext.
 */
export function RichTextEditor({ value, onChange, label = "Body" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!ref.current || seeded.current) return;
    ref.current.innerHTML = value || "<p></p>";
    seeded.current = true;
  }, [value]);

  function run(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function insertBlock(html: string) {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const btn =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--adm-radius-sm)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 text-xs font-semibold text-[var(--adm-ink)] hover:border-[var(--adm-action)] disabled:opacity-40";

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--adm-ink)]">{label}</span>
      <div
        className="flex flex-wrap gap-1 rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-1.5"
        role="toolbar"
        aria-label="Formatting"
      >
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            className={btn}
            title={t.title}
            aria-label={t.title}
            onClick={() => t.cmd && run(t.cmd, t.arg)}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={btn}
          title="Link"
          aria-label="Link"
          onClick={() => {
            const url = window.prompt("Link URL (https://…)");
            if (url) run("createLink", url);
          }}
        >
          Link
        </button>
        <button
          type="button"
          className={btn}
          title="Image"
          aria-label="Image"
          onClick={() => {
            const url = window.prompt("Image URL (https://…)");
            if (url) run("insertImage", url);
          }}
        >
          Img
        </button>
        <button type="button" className={btn} title="Divider" aria-label="Divider" onClick={() => insertBlock("<hr />")}>
          —
        </button>
        <button
          type="button"
          className={btn}
          title="Callout"
          aria-label="Callout"
          onClick={() =>
            insertBlock(
              '<aside data-lh-block="callout" style="padding:14px 16px;border-left:4px solid #1748B5;background:#eef3ff;border-radius:8px;margin:16px 0"><p><strong>Tip:</strong> Add your callout text here.</p></aside>',
            )
          }
        >
          Tip
        </button>
        <button type="button" className={btn} title="Clear formatting" aria-label="Clear formatting" onClick={() => run("removeFormat")}>
          ⌧
        </button>
        <button type="button" className={btn} title="Undo" aria-label="Undo" onClick={() => run("undo")}>
          ↶
        </button>
        <button type="button" className={btn} title="Redo" aria-label="Redo" onClick={() => run("redo")}>
          ↷
        </button>
      </div>
      <div
        ref={ref}
        className="min-h-[280px] rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[var(--adm-focus)]"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-testid="blog-rich-editor"
        onInput={() => {
          if (ref.current) onChange(ref.current.innerHTML);
        }}
        suppressContentEditableWarning
      />
      <p className="text-xs text-[var(--adm-ink-2)]">Write visually — no HTML required. Advanced HTML source is below for rare fixes.</p>
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
