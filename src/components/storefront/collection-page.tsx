import { CollectionView } from "@/components/storefront/collection-view";
import { PendingBlock } from "@/components/ui/pending-block";
import { getV5Catalog, V5_COLS, v5Search } from "@/lib/catalog/v5";
import { buildCollectionView, type RawParams } from "@/lib/catalog/v5-collection";

/** Server wrapper shared by collection and search routes. `id` is a V5 collection id or `{ q }` for search. */
export async function CollectionPage({ id, q, searchParams }: { id?: string; q?: string; searchParams: RawParams }) {
  let P: Awaited<ReturnType<typeof getV5Catalog>> = [];
  try {
    P = await getV5Catalog();
  } catch {
    return (
      <div className="lh-container py-12">
        <PendingBlock title="Catalog temporarily unavailable">The product catalog could not be loaded. Please try again shortly.</PendingBlock>
      </div>
    );
  }
  const isSearch = q !== undefined;
  const col = id ? V5_COLS[id] : undefined;
  const base = isSearch ? v5Search(P, q) : col ? P.filter(col.f) : [];
  const view = buildCollectionView(base, searchParams, { isChromebooks: id === "chromebooks", extra: isSearch ? { q } : {} });
  return <CollectionView title={isSearch ? `Results for “${q}”` : col!.t} view={view} />;
}
