import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/content/social-proof-server";

/**
 * Public, read-only: anonymous recent-order notices built from real confirmed orders (empty when the feature is off or
 * no order qualifies). The payload carries no order id, number, customer name, phone, address, quantity or exact time.
 */
export async function GET() {
  const items = await getRecentActivity();
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300" } },
  );
}
