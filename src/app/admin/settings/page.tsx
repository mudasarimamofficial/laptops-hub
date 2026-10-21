import { createServiceClient } from "@/lib/supabase/server";
import { PendingBlock } from "@/components/ui/pending-block";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("store_settings").select("key, value");
  const { data: zones } = await supabase.from("shipping_zones").select("*").order("name");

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Store settings</h1>
      <div className="mt-6">
        <PendingBlock title="Owner decisions required">
          Shipping rates, COD fees, served cities, and legal policies must be set by the merchant. Do not invent fees.
          Checkout remains blocked until an active shipping zone exists and <code>cod_checkout.enabled</code> is true.
        </PendingBlock>
      </div>
      <h2 className="mt-10 font-semibold">Current settings</h2>
      <pre className="mt-3 overflow-auto rounded-xl bg-[var(--lh-navy)] p-4 text-xs text-white/80">
        {JSON.stringify(settings, null, 2)}
      </pre>
      <h2 className="mt-10 font-semibold">Shipping zones</h2>
      <pre className="mt-3 overflow-auto rounded-xl bg-[var(--lh-navy)] p-4 text-xs text-white/80">
        {JSON.stringify(zones, null, 2)}
      </pre>
    </div>
  );
}
