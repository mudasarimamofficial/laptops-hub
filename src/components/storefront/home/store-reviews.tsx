"use client";

import { useEffect, useRef, useState } from "react";
import {
  SOURCE_LABEL,
  formatReviewDate,
  googleSourceLinkLabel,
  initials,
  splitRows,
  type PublicTestimonial,
} from "@/lib/content/testimonials";
import s from "./store-reviews.module.css";

/** A row animates only with at least this many distinct reviews; fewer stay a static, swipeable row (never padded). */
const MIN_FOR_MOTION = 4;
/** Visual repeats so one copy of a row is wider than the widest screens; repeats are aria-hidden and inert. */
const MIN_CARDS_PER_COPY = 10;

function GoogleG() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={s.stars} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className={i > rating ? s.starOff : undefined}>
          <path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

function Avatar({ t }: { t: PublicTestimonial }) {
  const [broken, setBroken] = useState(false);
  if (!t.avatarUrl || broken) {
    return (
      <span className={s.avatar} aria-hidden="true">
        {initials(t.authorName)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- owner-supplied https avatar with recorded permission
    <img
      className={s.avatar}
      src={t.avatarUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function ReviewCard({ t, clone = false, as: Tag = "article" }: { t: PublicTestimonial; clone?: boolean; as?: "article" | "li" }) {
  const date = formatReviewDate(t.reviewDate);
  const googleLink = t.source === "google" && t.sourceUrl ? googleSourceLinkLabel(t.authorName, t.sourceUrl) : null;
  const props = clone
    ? { "aria-hidden": true as const, "data-clone": "", inert: true }
    : { "aria-label": `Review by ${t.authorName}` };
  return (
    <Tag className={s.card} data-testid={clone ? undefined : "store-review"} data-source={t.source} {...props}>
      <div className={s.cardTop}>
        {t.rating ? <Stars rating={t.rating} /> : <span />}
        {date ? (
          <time className={s.date} dateTime={t.reviewDate ?? undefined}>
            {date}
          </time>
        ) : null}
      </div>
      <p className={s.text}>{t.body}</p>
      <div className={s.person}>
        <Avatar t={t} />
        <div style={{ minWidth: 0 }}>
          <span className={s.name}>{t.authorName}</span>
          <span className={s.source} data-testid={clone ? undefined : "store-review-source"}>
            {t.source === "google" ? <GoogleG /> : null}
            {SOURCE_LABEL[t.source]}
            {googleLink && t.sourceUrl ? (
              <>
                {" · "}
                <a href={t.sourceUrl} target="_blank" rel="noopener nofollow ugc" tabIndex={clone ? -1 : undefined}>
                  {googleLink.visible}
                  <span className="sr-only">{googleLink.srOnly}</span>
                </a>
              </>
            ) : null}
          </span>
        </div>
      </div>
    </Tag>
  );
}

function Row({ items, dir, animated }: { items: PublicTestimonial[]; dir: "left" | "right"; animated: boolean }) {
  if (!animated) {
    return (
      <div className={s.track}>
        <div className={s.copy}>
          {items.map((t) => (
            <ReviewCard key={t.id} t={t} />
          ))}
        </div>
      </div>
    );
  }
  const repeats = Math.max(1, Math.ceil(MIN_CARDS_PER_COPY / items.length));
  const copy = (pass: number) =>
    Array.from({ length: repeats }, (_, r) =>
      items.map((t) => <ReviewCard key={`${pass}-${r}-${t.id}`} t={t} clone={pass > 0 || r > 0} />),
    );
  const perCopy = repeats * items.length;
  return (
    <div className={s.track} data-dir={dir} style={{ ["--duration" as string]: `${Math.round(perCopy * 7.5)}s` }}>
      <div className={s.copy}>{copy(0)}</div>
      <div className={s.copy} aria-hidden="true">
        {copy(1)}
      </div>
    </div>
  );
}

export function StoreReviews({
  reviews,
  heading,
  intro,
  googleProfileUrl,
}: {
  reviews: PublicTestimonial[];
  heading: string;
  intro: string;
  googleProfileUrl: string | null;
}) {
  const section = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const rows = splitRows(reviews);
  const animated = rows.every((r) => r.length >= MIN_FOR_MOTION);

  // Stop the animation while the section is off screen (saves work; resumes when it scrolls back in).
  useEffect(() => {
    const el = section.current;
    if (!el || !animated || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { rootMargin: "120px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [animated]);

  if (!reviews.length) return null;
  const cls = [s.section, animated ? s.animated : s.static, paused ? s.paused : "", offscreen ? s.offscreen : ""].join(" ");
  return (
    <section ref={section} className={cls} aria-labelledby="store-reviews-title" data-testid="store-reviews">
      <div className={s.head}>
        <div>
          <span className={s.eyebrow}>REVIEWS</span>
          <h2 id="store-reviews-title" className={s.title}>
            {heading}
          </h2>
          {intro ? <p className={s.lede}>{intro}</p> : null}
        </div>
        <div className={s.controls}>
          {animated ? (
            <button
              type="button"
              className={s.btn}
              aria-pressed={paused}
              data-testid="store-reviews-pause"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Play" : "Pause"}
              <span className="sr-only"> the moving reviews</span>
            </button>
          ) : null}
          <button
            type="button"
            className={s.btn}
            data-testid="store-reviews-all"
            onClick={() => dialog.current?.showModal()}
          >
            Read all reviews
          </button>
          {googleProfileUrl ? (
            <a className={s.btn} href={googleProfileUrl} target="_blank" rel="noopener" data-testid="store-reviews-google">
              <GoogleG /> Our profile on Google
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className={s.rows}>
        {rows.map((r, i) => (
          <Row key={i} items={r} dir={i % 2 ? "right" : "left"} animated={animated} />
        ))}
      </div>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="store-reviews-dialog-title"
        data-testid="store-reviews-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={s.dialogHead}>
          <h3 id="store-reviews-dialog-title">{heading}</h3>
          <button type="button" className={s.dialogClose} aria-label="Close reviews" onClick={() => dialog.current?.close()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul className={s.dialogList}>
          {reviews.map((t) => (
            <ReviewCard key={t.id} t={t} as="li" />
          ))}
        </ul>
      </dialog>
    </section>
  );
}
