"use client";

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

export const admInputClass =
  "mt-1 w-full min-w-0 rounded-[var(--adm-radius)] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-sm text-[var(--adm-ink)] placeholder:text-[var(--adm-ink-muted)] focus-visible:border-[var(--adm-focus)]";

type Props = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
};

/** Label + control with an automatic `htmlFor`/`id` wire so Playwright and screen readers can find fields. */
export function AdminField({ label, htmlFor, hint, error, children, optional }: Props) {
  const autoId = useId();
  const id = htmlFor || autoId;
  const wired = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ id?: string }>;
    if (el.props.id) return child;
    // Only stamp id onto a single native control; compound children keep an explicit htmlFor.
    if (typeof el.type === "string" && ["input", "textarea", "select", "button"].includes(el.type)) {
      return cloneElement(el, { id });
    }
    return child;
  });

  return (
    <div className="block">
      <label htmlFor={id} className="text-sm font-medium text-[var(--adm-ink)]">
        {label}
        {optional ? <span className="ml-1 font-normal text-[var(--adm-ink-2)]">(optional)</span> : null}
      </label>
      {wired}
      {hint && !error ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">{hint}</p> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-[var(--adm-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
