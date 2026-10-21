import { PendingBlock } from "@/components/ui/pending-block";

export const metadata = { title: "Track order" };

export default function TrackOrderPage() {
  return (
    <div className="lh-content py-12">
      <p className="lh-kicker">Orders</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
        Track order
      </h1>
      <div className="mt-8">
        <PendingBlock title="Secure lookup required">
          Guest tracking uses order access tokens or phone verification — never guessable sequential IDs alone. Wire OTP
          / signed links after provider approval.
        </PendingBlock>
      </div>
    </div>
  );
}
