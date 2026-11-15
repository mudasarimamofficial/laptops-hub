import { revalidatePath, revalidateTag } from "next/cache";

/**
 * After any successful catalog write (product, variant, price, stock, media, status, import): expire the cached
 * catalog and collection data and the storefront pages built from them, so a published product, price or stock
 * change shows on the next storefront request instead of after the 60-second cache window.
 */
export function refreshStorefrontCatalog() {
  revalidateTag("catalog", { expire: 0 });
  revalidateTag("collections", { expire: 0 });
  revalidatePath("/", "layout");
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Wraps a route handler: a 2xx response refreshes the storefront catalog. */
export function withCatalogRefresh<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    const res = await handler(...args);
    if (res.ok) refreshStorefrontCatalog();
    return res;
  };
}
