"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPkr } from "@/lib/money";
import type { PublicProduct } from "@/types/catalog";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { useCompare, COMPARE_MAX } from "@/lib/commerce/compare-store";
import { canPurchase } from "@/lib/catalog/availability";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";

function chipList(product: PublicProduct): string[] {
  const s = product.specs;
  const chips = [
    s.cpu || s.processor,
    s.ram,
    s.storage || s.sto,
    s.size || s.screen,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return chips.slice(0, 4);
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const [hover, setHover] = useState(false);
  const img = product.images[0];
  const img2 = product.images[1];
  const toggle = useCompare((s) => s.toggle);
  const has = useCompare((s) => s.has(product.handle));
  const count = useCompare((s) => s.handles.length);
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const [inquiring, setInquiring] = useState(false);
  const purchasable = canPurchase(product);

  const manufacturer =
    product.manufacturer && !/laptops hub/i.test(product.manufacturer) ? product.manufacturer : null;
  const model = String(product.specs.model || product.title.split(" - ")[0] || product.title);
  const config = String(
    product.specs.config ||
      [product.specs.cpu || product.specs.processor, product.specs.ram, product.specs.storage || product.specs.sto]
        .filter(Boolean)
        .join(" · ") ||
      "",
  );
  const chips = chipList(product);
  const badge = product.category || product.productType || "Laptop";
  const cond = String(product.specs.condition || product.specs.cond || "Condition not listed");
  const showImg = hover && img2 ? img2 : img;

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--lh-border)] bg-white text-[var(--lh-ink)] transition duration-[220ms] ease-out hover:-translate-y-[3px] hover:border-[#B9CBE6] hover:shadow-[0_22px_40px_-28px_rgba(10,23,48,.45)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        href={`/products/${product.handle}`}
        aria-label={product.title}
        className="relative block aspect-[5/4] overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F3F7FD 62%, var(--lh-titanium) 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[9%] left-[12%] right-[12%] h-[10%] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(10,23,48,.16), transparent)" }}
        />
        {showImg ? (
          <Image
            src={showImg.url}
            alt={showImg.alt || product.title}
            fill
            className="object-contain p-[18px] mix-blend-multiply transition-transform duration-[350ms] ease-out"
            style={{ transform: hover ? "scale(1.03)" : "scale(1)" }}
            sizes="(max-width:768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--lh-ink-2)]">No image</div>
        )}
        <div className="absolute left-3 right-3 top-3 flex min-w-0 items-start justify-between gap-1.5">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#BCD0F2] bg-white px-2.5 py-[5px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--lh-action-hover)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lh-action)]" />
            {badge}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 border-t border-[var(--lh-border)] px-[18px] pb-[18px] pt-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-bold uppercase tracking-[0.08em] text-[var(--lh-ink-2)]">
            {manufacturer || "Brand"} · {cond}
          </span>
          {product.sku ? (
            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--lh-ink-2)]">
              {product.sku}
            </span>
          ) : null}
        </div>

        <Link href={`/products/${product.handle}`} className="flex flex-col gap-[3px] text-[var(--lh-ink)] no-underline">
          <span
            className="font-[family-name:var(--font-display)] text-[18px] font-semibold leading-[1.2] tracking-[-0.015em] text-pretty"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {model}
          </span>
          <span
            className="min-h-[2.8em] text-[13px] leading-[1.4] text-[var(--lh-ink-2)] text-pretty"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {config || product.title}
          </span>
        </Link>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-[5px]">
            {chips.map((chip) => (
              <span
                key={chip}
                className="whitespace-nowrap rounded-[7px] bg-[var(--lh-ice)] px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--lh-ink)]"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 gap-x-2.5 pt-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--lh-ink-2)]">Price</span>
            <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-[21px] font-bold tracking-[-0.02em]">
              {formatPkr(product.pricePaisa)}
            </span>
          </div>
          <button
            type="button"
            aria-pressed={has}
            disabled={!has && count >= COMPARE_MAX}
            onClick={() => toggle(product.handle)}
            className="inline-flex h-9 items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-3 pl-2.5 text-xs font-semibold transition disabled:opacity-50"
            style={
              has
                ? {
                    borderColor: "#2159D4",
                    background: "#EAF3FE",
                    color: "#1748B5",
                  }
                : {
                    borderColor: "#DAE5F2",
                    background: "#FFFFFF",
                    color: "#102039",
                  }
            }
          >
            <span
              aria-hidden
              className="grid h-3.5 w-3.5 place-items-center rounded-[4px] border-[1.5px] text-[10px] leading-none text-white"
              style={
                has
                  ? { borderColor: "#2159D4", background: "#2159D4" }
                  : { borderColor: "#9AA7BA", background: "transparent", color: "transparent" }
              }
            >
              {has ? "✓" : ""}
            </span>
            {has ? "Comparing" : "Compare"}
          </button>
        </div>

        {purchasable ? (
          <button
            type="button"
            className="h-[46px] rounded-xl bg-[var(--lh-action)] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] transition hover:bg-[var(--lh-action-hover)] active:scale-[0.98]"
            onClick={() => {
              if (!canPurchase(product)) return;
              add({
                variantId: product.variantId,
                handle: product.handle,
                title: product.title,
                unitPricePaisa: product.pricePaisa,
                quantity: 1,
                imageUrl: img?.url,
                maxPerOrder: product.maxPerOrder,
              });
              setAdded(true);
              openCartDrawer();
              window.setTimeout(() => setAdded(false), 1400);
            }}
          >
            {added ? "Added" : "Add to cart"}
          </button>
        ) : (
          <button
            type="button"
            className="h-[46px] rounded-xl border border-[var(--lh-border)] bg-white text-sm font-bold text-[var(--lh-ink)] transition hover:border-[var(--lh-action)]"
            onClick={() => setInquiring(true)}
          >
            Ask about this product
          </button>
        )}
      </div>
      {!purchasable ? (
        <InquiryDialog
          open={inquiring}
          onClose={() => setInquiring(false)}
          productTitle={product.title}
          productHandle={product.handle}
        />
      ) : null}
    </article>
  );
}
