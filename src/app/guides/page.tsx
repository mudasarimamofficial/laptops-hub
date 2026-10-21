import { PendingBlock } from "@/components/ui/pending-block";

export const metadata = { title: "Guides" };

export default function GuidesPage() {
  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Editorial</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">Guides</h1>
      <div className="mt-8">
        <PendingBlock title="Guides remain draft">
          Four articles stay unpublished until editorial approval.
        </PendingBlock>
      </div>
    </div>
  );
}
