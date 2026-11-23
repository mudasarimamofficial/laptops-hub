"use client";

import { createContext, useContext } from "react";
import type { DiscountCampaign } from "@/lib/commerce/pricing";
import { priceWithCampaign, type PricedUnit } from "@/lib/commerce/pricing";

const DiscountCtx = createContext<DiscountCampaign | null>(null);

export function DiscountProvider({
  campaign,
  children,
}: {
  campaign: DiscountCampaign | null;
  children: React.ReactNode;
}) {
  return <DiscountCtx.Provider value={campaign}>{children}</DiscountCtx.Provider>;
}

export function useActiveDiscount(): DiscountCampaign | null {
  return useContext(DiscountCtx);
}

export function usePricedUnit(listPaisa: number): PricedUnit {
  const campaign = useActiveDiscount();
  return priceWithCampaign(listPaisa, campaign);
}
