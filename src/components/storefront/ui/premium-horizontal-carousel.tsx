"use client";

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  step?: number;
  "aria-label"?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
  showArrows?: boolean;
  /** When true, arrow buttons are rendered by the parent (only progress + viewport here). */
  arrowsExternal?: boolean;
  testId?: string;
};

function progressOf(el: HTMLDivElement): number {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 1) return 0;
  return Math.min(1, Math.max(0, el.scrollLeft / max));
}

/** Shared horizontal snap carousel with a proportional scroll-progress track. */
export function PremiumHorizontalCarousel({
  children,
  className,
  style,
  step = 560,
  "aria-label": ariaLabel = "Carousel",
  viewportRef,
  showArrows = true,
  arrowsExternal = false,
  testId,
}: Props) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = viewportRef ?? localRef;
  const [progress, setProgress] = useState(0);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const raf = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const max = node.scrollWidth - node.clientWidth;
      const has = max > 4;
      setOverflow(has);
      setProgress(progressOf(node));
      setAtStart(node.scrollLeft <= 2);
      setAtEnd(!has || node.scrollLeft >= max - 2);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf.current);
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, children]);

  const btn: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid var(--lh-border)",
    background: "#FFFFFF",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };

  const arrows =
    showArrows && !arrowsExternal && overflow ? (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 10 }}>
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} left`}
          className="v5-hov-bd-action"
          disabled={atStart}
          style={{ ...btn, opacity: atStart ? 0.4 : 1, cursor: atStart ? "default" : "pointer" }}
          onClick={() => ref.current?.scrollBy({ left: -step, behavior: "smooth" })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} right`}
          className="v5-hov-bd-action"
          disabled={atEnd}
          style={{ ...btn, opacity: atEnd ? 0.4 : 1, cursor: atEnd ? "default" : "pointer" }}
          onClick={() => ref.current?.scrollBy({ left: step, behavior: "smooth" })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    ) : null;

  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {arrows}
      <div
        ref={ref}
        className={`lh-premium-carousel-viewport${className ? ` ${className}` : ""}`}
        aria-label={ariaLabel}
        style={style}
      >
        {children}
      </div>
      {overflow ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={`${ariaLabel} scroll position`}
          data-testid="carousel-progress"
          style={{
            height: 4,
            borderRadius: 999,
            background: "rgba(16, 32, 57, 0.12)",
            overflow: "hidden",
            maxWidth: 220,
            marginInline: "auto",
            width: "100%",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(14, 14 + progress * 86)}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--lh-grad-action-from), var(--lh-grad-action-to))",
              transition: "width 100ms linear",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Hook helpers for parents that place arrows in a section header. */
export function useCarouselControls(step = 560) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: -1 | 1) => viewportRef.current?.scrollBy({ left: dir * step, behavior: "smooth" });
  return { viewportRef, scrollLeft: () => scrollBy(-1), scrollRight: () => scrollBy(1) };
}
