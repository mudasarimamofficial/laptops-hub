import { PendingBlock } from "@/components/ui/pending-block";

const TITLES: Record<string, string> = {
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
  return { title: TITLES[slug] || "Page" };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const title = TITLES[slug] || slug;

  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Information</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">{title}</h1>
      <div className="mt-8">
        <PendingBlock title={`${title} — awaiting owner approval`}>
          Verified content from <code>data/lh-content.js</code> will be wired through the CMS. Until then we show this
          honest pending state instead of inventing policies or contact details.
        </PendingBlock>
      </div>
    </div>
  );
}
