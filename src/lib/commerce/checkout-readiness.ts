import { MANDATORY_POLICY_SLUGS } from "@/lib/content/links";

/**
 * COD checkout readiness: every gate evaluated separately so Admin can show *why* ordering is closed and the
 * storefront never renders a clickable checkout that the API will refuse.
 *
 * Pure evaluation lives here (unit-tested); data loading lives in checkout-readiness-server.ts.
 * Infrastructure flags are reported by NAME and state only — never values of secrets.
 */

export type GateId =
  | "client_flag"
  | "server_flag"
  | "db_setting"
  | "shipping_zones"
  | "policies"
  | "purchasable_catalog"
  | "notifications"
  | "staff";

export type GateState = "pass" | "fail" | "warn";

export type Gate = {
  id: GateId;
  label: string;
  state: GateState;
  /** Whether a failure closes public ordering (hard gate) or is advisory (warn). */
  blocking: boolean;
  detail: string;
  /** Admin route where the gate can be corrected, or null when it needs an owner/infra action outside Admin. */
  fixHref: string | null;
  owner: "engineering" | "merchant" | "owner-approval";
};

export type ReadinessInput = {
  env: { clientFlag: string | undefined; serverFlag: string | undefined };
  dbSetting: { enabled: boolean; reason: string | null } | null;
  zones: { name: string; isActive: boolean; provinces: string[] }[];
  policies: Record<string, boolean>;
  purchasableVariants: number;
  trackedVariants: number;
  notifications: { transportConfigured: boolean };
  activeOwnersOrAdmins: number;
};

export type Readiness = {
  open: boolean;
  gates: Gate[];
  blockingFailures: GateId[];
};

export function evaluateCheckoutReadiness(input: ReadinessInput): Readiness {
  const gates: Gate[] = [];
  const clientOn = input.env.clientFlag === "true";
  const serverOn = input.env.serverFlag === "true";

  gates.push({
    id: "client_flag",
    label: "Storefront checkout switch (NEXT_PUBLIC_COD_CHECKOUT_ENABLED)",
    state: clientOn ? "pass" : "fail",
    blocking: true,
    detail: clientOn ? "Enabled in this deployment build." : "Off in this deployment build (requires a redeploy to change).",
    fixHref: null,
    owner: "owner-approval",
  });
  gates.push({
    id: "server_flag",
    label: "Server order API switch (COD_CHECKOUT_ENABLED)",
    state: serverOn ? "pass" : "fail",
    blocking: true,
    detail: serverOn ? "Order API accepts submissions." : "Order API refuses all submissions (403).",
    fixHref: null,
    owner: "owner-approval",
  });
  gates.push({
    id: "db_setting",
    label: "Store setting: COD checkout",
    state: input.dbSetting?.enabled === true ? "pass" : "fail",
    blocking: true,
    detail:
      input.dbSetting?.enabled === true
        ? "Enabled in store settings."
        : `Disabled in store settings${input.dbSetting?.reason ? ` — ${input.dbSetting.reason}` : ""}.`,
    fixHref: "/admin/settings",
    owner: "owner-approval",
  });

  const serviceable = input.zones.filter((z) => z.isActive && z.provinces.length > 0);
  gates.push({
    id: "shipping_zones",
    label: "Active serviceable shipping zones",
    state: serviceable.length > 0 ? "pass" : "fail",
    blocking: true,
    detail:
      serviceable.length > 0
        ? `${serviceable.length} active zone(s): ${serviceable.map((z) => z.name).join(", ")}. Fees are not yet owner-approved courier tariffs until confirmed.`
        : "No active zone covers any province — every quote would be refused.",
    fixHref: "/admin/settings#shipping",
    owner: "merchant",
  });

  const missing = MANDATORY_POLICY_SLUGS.filter((s) => !input.policies[s]);
  gates.push({
    id: "policies",
    label: "Mandatory policies published and legally approved",
    state: missing.length === 0 ? "pass" : "fail",
    blocking: true,
    detail:
      missing.length === 0
        ? "Shipping, returns, warranty, privacy and terms are public."
        : `Not public yet: ${missing.join(", ")} (needs owner-written text and legal approval).`,
    fixHref: "/admin/content",
    owner: "owner-approval",
  });

  gates.push({
    id: "purchasable_catalog",
    label: "Purchasable catalog",
    state: input.purchasableVariants === 0 ? "fail" : input.trackedVariants === 0 ? "warn" : "pass",
    blocking: true,
    detail:
      input.purchasableVariants === 0
        ? "No purchasable variants."
        : input.trackedVariants === 0
          ? `${input.purchasableVariants} purchasable variant(s), all untracked: orders are not limited by physical stock. Enter owner-verified quantities in Inventory.`
          : `${input.purchasableVariants} purchasable variant(s), ${input.trackedVariants} with tracked stock.`,
    fixHref: "/admin/inventory",
    owner: "merchant",
  });

  gates.push({
    id: "notifications",
    label: "Order notification transport",
    state: input.notifications.transportConfigured ? "pass" : "warn",
    blocking: false,
    detail: input.notifications.transportConfigured
      ? "Email transport configured; failures stay in the outbox for retry."
      : "No email transport configured: new orders are only visible in Admin → Orders.",
    fixHref: null,
    owner: "owner-approval",
  });

  gates.push({
    id: "staff",
    label: "Active owner/admin account",
    state: input.activeOwnersOrAdmins > 0 ? "pass" : "fail",
    blocking: false,
    detail:
      input.activeOwnersOrAdmins > 0
        ? `${input.activeOwnersOrAdmins} active owner/admin account(s).`
        : "No active owner/admin can confirm or fulfil orders.",
    fixHref: "/admin/staff",
    owner: "owner-approval",
  });

  const blockingFailures = gates.filter((g) => g.blocking && g.state === "fail").map((g) => g.id);
  return { open: blockingFailures.length === 0, gates, blockingFailures };
}

/** Delivery fee label: PKR 0 is a legitimate, deliberate merchant setting and must read as free, not "Rs 0". */
export function deliveryFeeLabel(paisa: number, format: (p: number) => string): string {
  if (!Number.isFinite(paisa) || paisa < 0) throw new Error("invalid_fee");
  return paisa === 0 ? "Free delivery" : `Delivery ${format(paisa)}`;
}
