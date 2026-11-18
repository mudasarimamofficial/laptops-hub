"use client";

type Props = {
  dirty: boolean;
  busy: boolean;
  savedMessage?: string | null;
  error?: string | null;
  onSave: () => void;
  saveLabel?: string;
  secondary?: React.ReactNode;
};

/** Sticky save feedback for object editors. */
export function AdminSaveBar({
  dirty,
  busy,
  savedMessage,
  error,
  onSave,
  saveLabel = "Save",
  secondary,
}: Props) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-6 border-t border-[var(--adm-border)] bg-[var(--adm-canvas)]/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--adm-canvas)]/80">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={onSave}
          className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-5 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
        >
          {busy ? "Saving…" : saveLabel}
        </button>
        {secondary}
        {dirty && !busy ? <span className="text-xs text-[var(--adm-warning)]">Unsaved changes</span> : null}
        {!dirty && savedMessage ? <span className="text-xs text-[var(--adm-success)]">{savedMessage}</span> : null}
        {error ? (
          <span role="alert" className="text-xs text-[var(--adm-danger)]">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
