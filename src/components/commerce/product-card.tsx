import Image from "next/image";
import Link from "next/link";
import { formatPkr } from "@/lib/money";
import type { PublicProduct } from "@/types/catalog";

export function ProductCard({ product }: { product: PublicProduct }) {
  const img = product.images[0];
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white transition hover:border-[var(--lh-action)]/30 hover:shadow-[0_12px_40px_-20px_rgba(33,89,212,0.45)]">
      <Link href={`/products/${product.handle}`} className="relative block aspect-[4/3] bg-[var(--lh-titanium)]">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt || product.title}
            fill
            className="object-contain p-4 transition duration-300 group-hover:scale-[1.03]"
            sizes="(max-width:768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--lh-ink-2)]">No image</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[var(--lh-ink)] shadow-sm ring-1 ring-[var(--lh-border)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lh-action)]" />
            {product.category}
          </span>
        ) : null}
        <h3 className="font-[family-name:var(--font-display)] text-[0.95rem] font-semibold leading-snug tracking-[-0.03em] text-[var(--lh-ink)]">
          <Link href={`/products/${product.handle}`}>{product.title}</Link>
        </h3>
        <p className="mt-auto font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.04em] text-[var(--lh-ink)]">
          {formatPkr(product.pricePaisa)}
        </p>
        <Link
          href={`/products/${product.handle}`}
          className="mt-1 inline-flex items-center justify-center rounded-[var(--lh-radius-pill)] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-4 py-2 text-sm font-semibold text-white"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
