import { z } from "zod";

/** Shipping-zone input for POST /api/admin/shipping-zones and PATCH /api/admin/shipping-zones/[id]. */
export const zoneInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a zone name (at least 2 characters).").max(120, "Use at most 120 characters for the name."),
  provinces: z.array(z.string().trim().min(2)).min(1, "Select at least one province."),
  cities: z.array(z.string().trim().min(2, "Each city needs at least 2 characters.")).default([]),
  excludedCities: z.array(z.string().trim().min(2, "Each excluded city needs at least 2 characters.")).max(200).default([]),
  flatFeePkr: z.number({ error: "Enter the delivery fee in rupees (0 = free delivery)." }).int("Enter the delivery fee in whole rupees.").min(0, "The delivery fee cannot be negative.").max(1_000_000),
  codFeePkr: z.number({ error: "Enter the COD fee in rupees (0 = no COD fee)." }).int("Enter the COD fee in whole rupees.").min(0, "The COD fee cannot be negative.").max(1_000_000),
  /** Optional: orders whose subtotal reaches this pay no delivery fee (COD fee still applies). null = no threshold. */
  freeShippingMinPkr: z.number({ error: "Enter the free-delivery minimum in rupees, or leave it empty." }).int("Use whole rupees.").min(0, "The minimum cannot be negative.").max(100_000_000).nullable().default(null),
  isActive: z.boolean().default(false),
  notes: z.string().trim().max(500, "Keep the note under 500 characters.").default(""),
});

/** First human-readable problem from a failed parse (shown to staff). */
export function zoneInputProblem(error: z.ZodError): string {
  return error.issues[0]?.message || "Some zone details were not accepted.";
}

export const ZONE_COLUMNS = "id, name, provinces, cities, excluded_cities, flat_fee_paisa, cod_fee_paisa, free_shipping_min_paisa, is_active, notes";
