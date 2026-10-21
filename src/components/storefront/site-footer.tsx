import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[var(--lh-navy)] text-[color-mix(in_srgb,white_82%,transparent)]">
      <div className="lh-container grid gap-10 py-[var(--lh-section)] md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="font-[family-name:var(--font-display)] text-lg font-bold text-white">Laptops</span>
            <span className="rounded-[6px] bg-[var(--lh-signal)] px-1.5 py-0.5 font-[family-name:var(--font-display)] text-sm font-extrabold text-white">
              HUB
            </span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[color-mix(in_srgb,white_65%,transparent)]">
            Independent Pakistan electronics retailer. Cash on Delivery only. Business policies pending owner approval.
          </p>
        </div>
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--lh-electric)]">
            Explore
          </h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/collections/all">All products</Link></li>
            <li><Link href="/collections/chromebooks">Chromebooks</Link></li>
            <li><Link href="/guides">Guides</Link></li>
            <li><Link href="/track-order">Track order</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--lh-electric)]">
            Policies
          </h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/pages/shipping">Shipping</Link></li>
            <li><Link href="/pages/returns">Returns</Link></li>
            <li><Link href="/pages/warranty">Warranty</Link></li>
            <li><Link href="/pages/privacy">Privacy</Link></li>
            <li><Link href="/pages/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-white/45">
        © {new Date().getFullYear()} Laptops HUB · COD only · PKR · Asia/Karachi
      </div>
    </footer>
  );
}
