import { PendingBlock } from "@/components/ui/pending-block";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_TITLES: Record<string, string> = {
  about: "About Laptops HUB",
  "why-laptops-hub": "Why Laptops HUB",
  contact: "Contact",
  faq: "FAQ",
  shipping: "Shipping & delivery",
  returns: "Returns & refunds",
  warranty: "Warranty",
  "condition-guide": "Condition guide",
  "how-to-choose": "How to choose a laptop",
  "comparison-guide": "Using comparison",
  "order-inquiries": "Order inquiries",
  privacy: "Privacy policy",
  terms: "Terms & conditions",
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_pages")
      .select("title, status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (data?.title) return { title: data.title };
  } catch {
    /* fall through */
  }
  return { title: FALLBACK_TITLES[slug] || "Page" };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  let title = FALLBACK_TITLES[slug] || slug;
  let bodyHtml: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_pages")
      .select("title, body_html, status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (data) {
      title = data.title;
      bodyHtml = data.body_html || "";
    }
  } catch {
    /* pending fallback */
  }

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Information</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">{title}</h1>
      <div className="mt-8">
        {bodyHtml ? (
          <div className="prose prose-neutral max-w-none text-[var(--lh-ink-2)]" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <PendingBlock title={`${title} — awaiting owner approval`}>
            Published CMS content will appear here. Until the owner publishes approved copy, we show this honest pending
            state instead of inventing policies or contact details.
          </PendingBlock>
        )}
      </div>
    </div>
  );
}
