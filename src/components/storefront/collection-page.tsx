import { CollectionView } from "@/components/storefront/collection-view";
import { PendingBlock } from "@/components/ui/pending-block";
import { getV5Catalog, V5_COLS, v5Search } from "@/lib/catalog/v5";
import { buildCollectionView, type RawParams } from "@/lib/catalog/v5-collection";
import type { StorefrontCollection } from "@/lib/collections/storefront";
import { getPublishedThemeGlobals } from "@/lib/content/published-homepage";

/**
 * Server wrapper shared by collection and search routes. `id` is a V5 collection id, `custom` a merchant-made
 * collection (Admin → Collections, same V5 grid and filters), or `{ q }` for search.
 */
export async function CollectionPage({
  id,
  q,
  custom,
  searchParams,
}: {
  id?: string;
  q?: string;
  custom?: StorefrontCollection;
  searchParams: RawParams;
}) {
  let P: Awaited<ReturnType<typeof getV5Catalog>> = [];
  try {
    P = await getV5Catalog();
  } catch {
    return (
      <div className="lh-container py-12">
        <PendingBlock title="Catalog temporarily unavailable" label="Please try again">The product catalog could not be loaded. Please try again shortly.</PendingBlock>
      </div>
    );
  }
  const isSearch = q !== undefined;
  const col = id ? V5_COLS[id] : undefined;
  let base = isSearch ? v5Search(P, q) : col ? P.filter(col.f) : [];
  if (custom) {
    const byHandle = new Map(P.map((p) => [p.h, p]));
    base = custom.handles.map((h) => byHandle.get(h)).filter((p): p is (typeof P)[number] => Boolean(p));
  }
  const copy = await getPublishedThemeGlobals();
  const view = buildCollectionView(base, searchParams, {
    isChromebooks: id === "chromebooks",
    extra: isSearch ? { q } : {},
    keepOrder: custom?.mode === "manual",
  });
  const title = isSearch ? `${copy.colSearchTitle} “${q}”` : custom ? custom.title : col!.t;
  return <CollectionView title={title} view={view} copy={copy} />;
}
