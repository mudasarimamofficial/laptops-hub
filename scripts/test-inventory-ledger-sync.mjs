/** Local-only: variant sync must write inventory_ledger for quantity changes. */
import { createClient } from "@supabase/supabase-js";
import { assertLocalOnly } from "./lib/local-only.mjs";

await assertLocalOnly("inventory-ledger-sync");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const email = `inv-ledger-${Date.now()}@example.com`;
const password = "InvLedger1!pass";
const { data: created } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
const userId = created.user.id;
await sb.from("admin_memberships").upsert({ user_id: userId, role: "owner", is_active: true });

const handle = `inv-ledger-${Date.now()}`;
const { data: product, error: pErr } = await sb
  .from("products")
  .insert({
    handle,
    title: "Inventory Ledger Test",
    status: "draft",
    description_safe: "",
  })
  .select("id")
  .single();
if (pErr) throw pErr;

const { data: v1, error: vErr } = await sb
  .from("product_variants")
  .insert({
    product_id: product.id,
    title: "Default",
    price_paisa: 1000000,
    inventory_mode: "tracked",
    quantity_on_hand: 5,
    option_values: {},
    position: 1,
  })
  .select("id")
  .single();
if (vErr) throw vErr;

const { data: sync, error: sErr } = await sb.rpc("sync_product_variants", {
  payload: {
    actor_user_id: userId,
    product_id: product.id,
    option_names: [],
    remove_missing: true,
    variants: [
      {
        id: v1.id,
        title: "Default",
        price_paisa: 1000000,
        inventory_mode: "tracked",
        quantity_on_hand: 12,
        purchasable: true,
        option_values: {},
        allow_oversell: false,
      },
    ],
  },
});
if (sErr) throw sErr;
if (!sync?.ok) throw new Error("sync failed");

const { data: ledger } = await sb
  .from("inventory_ledger")
  .select("delta, quantity_after, reason")
  .eq("variant_id", v1.id)
  .order("created_at", { ascending: false });

if (!ledger?.length) {
  console.error("FAIL: no ledger rows");
  process.exit(1);
}
const last = ledger[0];
if (last.delta !== 7 || last.quantity_after !== 12) {
  console.error("FAIL: unexpected ledger", last);
  process.exit(1);
}

// Negative stock blocked
const { error: negErr } = await sb.rpc("sync_product_variants", {
  payload: {
    actor_user_id: userId,
    product_id: product.id,
    variants: [
      {
        id: v1.id,
        title: "Default",
        price_paisa: 1000000,
        inventory_mode: "tracked",
        quantity_on_hand: -1,
        purchasable: true,
        option_values: {},
        allow_oversell: false,
      },
    ],
  },
});
if (!negErr) {
  console.error("FAIL: negative stock allowed");
  process.exit(1);
}

console.log("inventory-ledger-sync: ok", { delta: last.delta, after: last.quantity_after });
process.exit(0);
