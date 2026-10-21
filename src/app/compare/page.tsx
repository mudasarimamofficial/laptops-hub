import { PendingBlock } from "@/components/ui/pending-block";

export const metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Compare</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        Compare up to 4
      </h1>
      <div className="mt-8">
        <PendingBlock title="Compare tray port in progress">
          V5 compare tray UX (max 4, persisted) will use the live catalog. Add products from PDPs once the client tray
          component is wired.
        </PendingBlock>
      </div>
    </div>
  );
}
