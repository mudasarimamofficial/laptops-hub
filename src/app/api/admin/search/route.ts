import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse, type StaffRole } from "@/lib/auth/staff";
import { adminSearchTerm, phoneDigits, type AdminSearchResult } from "@/lib/admin/search-term";

const headers = { "Cache-Control": "no-store" };

/** Same role sets as the Products and Orders sections of the admin navigation (src/components/admin/shell/nav.ts). */
const PRODUCT_ROLES: StaffRole[] = ["owner", "admin", "manager", "editor"];
const ORDER_ROLES: StaffRole[] = ["owner", "admin", "manager", "fulfillment"];

/**
 * Global admin search (header box, Ctrl/⌘ K). Role-scoped: each group is searched only for roles that may open that
 * section. Returns identifiers and statuses only — no customer names, phones or addresses (the order page shows those
 * to permitted roles). A phone number finds its orders, but the phone is not echoed back.
 */
export async function GET(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient();
    const q = adminSearchTerm(new URL(request.url).searchParams.get("q"));
    const out: AdminSearchResult = { products: [], orders: [] };
    if (q.length < 2) return NextResponse.json(out, { headers });

    const jobs: Promise<void>[] = [];
    if (PRODUCT_ROLES.includes(staff.role)) {
      jobs.push(
        (async () => {
          const [byText, bySku] = await Promise.all([
            supabase.from("products").select("id, handle, title, status").is("deleted_at", null).or(`title.ilike.%${q}%,handle.ilike.%${q}%`).order("title").limit(8),
            supabase.from("product_variants").select("sku, product_id").ilike("sku", `%${q}%`).limit(8),
          ]);
          const rows = new Map<string, { handle: string; title: string; status: string; sku: string | null }>();
          for (const p of byText.data || []) rows.set(p.id, { handle: p.handle, title: p.title, status: p.status, sku: null });
          const skuIds = (bySku.data || []).map((v) => v.product_id).filter((id) => !rows.has(id));
          if (skuIds.length) {
            const { data } = await supabase.from("products").select("id, handle, title, status").is("deleted_at", null).in("id", skuIds);
            for (const p of data || []) rows.set(p.id, { handle: p.handle, title: p.title, status: p.status, sku: bySku.data!.find((v) => v.product_id === p.id)?.sku ?? null });
          }
          out.products = Array.from(rows.values()).slice(0, 8);
        })(),
      );
    }
    if (ORDER_ROLES.includes(staff.role)) {
      jobs.push(
        (async () => {
          const digits = phoneDigits(q);
          const filter = [`order_number.ilike.%${q}%`, ...(digits ? [`customer_phone_normalized.ilike.%${digits}%`] : [])].join(",");
          const { data } = await supabase.from("orders").select("order_number, status, payment_status, total_due_paisa").or(filter).order("created_at", { ascending: false }).limit(8);
          out.orders = (data || []).map((o) => ({ orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status, totalDuePaisa: o.total_due_paisa }));
        })(),
      );
    }
    await Promise.all(jobs);
    return NextResponse.json(out, { headers });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
