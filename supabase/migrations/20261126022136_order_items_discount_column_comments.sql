-- LH-025 Option A: restore the two column comments that 20261123120000_discount_campaigns_and_pricing.sql
-- defines but production never received (production's ledger records an earlier draft of that migration).
-- Metadata only: COMMENT ON COLUMN changes pg_description and nothing else. No tables, columns, data,
-- functions, grants, policies, campaigns or orders are touched. Safe to re-run (COMMENT replaces in place).
COMMENT ON COLUMN public.order_items.unit_list_price_paisa IS 'Catalog list price at order time (paisa). unit_price_paisa is the charged selling price.';
COMMENT ON COLUMN public.order_items.line_discount_paisa IS 'Per-line savings: (list - selling) * quantity.';
