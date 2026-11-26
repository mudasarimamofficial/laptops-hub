import { notFound } from "next/navigation";
import {
  CollectionMembershipEditor,
  type MemberRow,
} from "@/components/admin/collection-membership";
import { CollectionRuleBuilder } from "@/components/admin/collection-rule-builder";
import { CollectionDetailsForm } from "@/components/admin/collection-details-form";
import { V5_COLS } from "@/lib/catalog/v5-model";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { listAllPublicProducts } from "@/lib/catalog/queries";
import {
  collectionMode,
  isAutomatedRule,
  productMatchesRule,
  type CollectionRule,
} from "@/lib/collections/rule-eval";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function AdminCollectionDetailPage({ params }: Props) {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("collections")
    .select(
      "id, slug, title, description, published, featured, rule, collection_type, sort_order, seo_title, seo_description, collection_products(position, product_id, products(id, handle, title, status))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const builtIn = Object.hasOwn(V5_COLS, data.slug);

  const members = (
    (data.collection_products as {
      position: number;
      product_id: string;
      products:
        | { id: string; handle: string; title: string; status: string }
        | { id: string; handle: string; title: string; status: string }[]
        | null;
    }[]) || []
  )
    .map((row) => {
      const products = Array.isArray(row.products)
        ? row.products[0]
        : row.products;
      return {
        product_id: row.product_id,
        position: row.position,
        products: products ?? null,
      } satisfies MemberRow;
    })
    .sort((a, b) => a.position - b.position);

  const rule = (
    data.rule && typeof data.rule === "object" ? data.rule : null
  ) as CollectionRule | null;
  // Same decision as the storefront (collectionMode), so this page never says "rules" while the shop shows picks.
  const mode = collectionMode({ collection_type: data.collection_type, rule, pinCount: members.length });
  const automated = mode === "automated";

  // What the storefront will show right now: rule matches among public products, or the public hand-picked ones.
  let preview: { count: number; titles: string[] } | null = null;
  if (!builtIn) {
    const all = await listAllPublicProducts(createPublicClient()).catch(() => null);
    if (all) {
      const shown = automated
        ? all.filter((p) => productMatchesRule(p, rule))
        : members.flatMap((m) => all.filter((p) => p.id === m.product_id));
      preview = { count: shown.length, titles: shown.slice(0, 5).map((p) => p.title) };
    }
  }
  // Picks that are drafts, archived, deleted or not for sale are kept but not shown.
  const hiddenPicks = !automated && preview ? members.length - preview.count : 0;

  return (
    <>
      <AdminPageHeader
        title={data.title}
        description={`Handle ${data.slug} · ${builtIn ? "Built-in storefront collection" : automated ? "Products chosen by rules" : "Products picked by hand"}`}
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/collections", label: "Collections" },
          { label: data.title },
        ]}
        actions={
          <StatusBadge
            status={builtIn || data.published ? "published" : "draft"}
          />
        }
      />
      <CollectionDetailsForm
        slug={data.slug}
        builtIn={builtIn}
        initial={{
          title: data.title,
          description: data.description || "",
          published: !!data.published,
          seoTitle: data.seo_title || "",
          seoDescription: data.seo_description || "",
        }}
      />
      {builtIn ? null : (
        <>
          <section
            data-testid="collection-mode"
            data-mode={mode}
            className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
          >
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
              How products are chosen: {automated ? "automatically, by rules" : "by hand"}
            </h2>
            <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
              {automated
                ? "Every active product that matches the rules below is shown, in the storefront's usual order. Clear the rules to pick products by hand instead."
                : "Only the products you add below are shown, in the order you set. Save rules below to choose products automatically instead."}
            </p>
            {automated && members.length > 0 ? (
              <p className="mt-2 text-sm" data-testid="collection-picks-kept">
                {members.length} hand-picked {members.length === 1 ? "product is" : "products are"} kept but not shown while
                rules are on. Clearing the rules brings {members.length === 1 ? "it" : "them"} back in the same order.
              </p>
            ) : null}
            {preview ? (
              <p className="mt-2 text-sm" data-testid="collection-preview">
                <strong>
                  {data.published ? "The storefront shows" : "When visible, the storefront will show"} {preview.count}{" "}
                  {preview.count === 1 ? "product" : "products"}
                </strong>
                {preview.titles.length ? `: ${preview.titles.join(", ")}${preview.count > preview.titles.length ? ", …" : ""}` : "."}
                {!automated && hiddenPicks > 0
                  ? ` ${hiddenPicks} picked ${hiddenPicks === 1 ? "product is" : "products are"} not on sale (draft, archived or no price), so ${hiddenPicks === 1 ? "it is" : "they are"} not shown.`
                  : ""}
              </p>
            ) : null}
          </section>
          <div className="mb-6">
            <CollectionRuleBuilder
              slug={data.slug}
              automated={automated}
              initialRule={isAutomatedRule(rule) ? rule : null}
            />
          </div>
          {!automated ? (
            <CollectionMembershipEditor slug={data.slug} members={members} />
          ) : null}
        </>
      )}
    </>
  );
}
