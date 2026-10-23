"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * V5 dialog behaviour (`onKey` + `componentDidUpdate` in the prototype): lock page scroll, move focus into the
 * dialog (first button, or `initialFocus`), trap Tab, close on Escape, restore focus to the opener on close.
 */
export function useDialog(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target = initialFocus?.current || ref.current?.querySelector<HTMLElement>("button");
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea")].filter(
        (x) => x.offsetParent !== null,
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!ref.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) {
        try {
          opener.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, ref, initialFocus]);
}
