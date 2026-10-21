import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="lh-header sticky top-0 z-50 border-b border-[var(--lh-border)] bg-[color-mix(in_srgb,var(--lh-canvas)_88%,transparent)] backdrop-blur-md">
      <div className="lh-container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="lh-wordmark flex items-baseline gap-1.5 no-underline">
          <span className="font-[family-name:var(--font-display)] text-[1.15rem] font-bold tracking-[-0.04em] text-[var(--lh-ink)]">
            Laptops
          </span>
          <span className="rounded-[var(--lh-radius-badge)] bg-[var(--lh-signal)] px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[0.95rem] font-extrabold tracking-[-0.03em] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]">
            HUB
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--lh-ink)] md:flex" aria-label="Primary">
          <Link href="/collections/all" className="hover:text-[var(--lh-action)]">
            Shop
          </Link>
          <Link href="/collections/laptops" className="hover:text-[var(--lh-action)]">
            Laptops
          </Link>
          <Link href="/collections/accessories" className="hover:text-[var(--lh-action)]">
            Accessories
          </Link>
          <Link href="/compare" className="hover:text-[var(--lh-action)]">
            Compare
          </Link>
          <Link href="/pages/contact" className="hover:text-[var(--lh-action)]">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="rounded-[var(--lh-radius-pill)] border border-[var(--lh-border)] px-3 py-1.5 text-sm text-[var(--lh-ink-2)] hover:bg-[var(--lh-ice)]"
          >
            Search
          </Link>
          <Link
            href="/cart"
            className="rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-4 py-1.5 text-sm font-semibold text-white shadow-sm"
          >
            Cart
          </Link>
        </div>
      </div>
    </header>
  );
}
