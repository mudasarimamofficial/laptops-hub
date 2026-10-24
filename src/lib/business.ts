/**
 * Owner-supplied business facts (docs/FINAL_LAUNCH_OWNER_INPUTS.md, setup step 5). A fact appears on the website only
 * when `confirmed` is true — the owner confirms which number is primary and answered, the exact address and the
 * hours; until then nothing here is rendered. WhatsApp links are offered only for a line confirmed as WhatsApp.
 */
export type BusinessPhone = { display: string; e164: string; primary: boolean; whatsapp: boolean; confirmed: boolean };

export const BUSINESS = {
  name: "Laptops HUB",
  city: "Bahawalpur",
  phones: [
    { display: "0309 3372974", e164: "+923093372974", primary: false, whatsapp: false, confirmed: false },
    { display: "0313 6565663", e164: "+923136565663", primary: false, whatsapp: false, confirmed: false },
    { display: "0339 9100199", e164: "+923399100199", primary: false, whatsapp: false, confirmed: false },
  ] as BusinessPhone[],
  /** Address and hours: published only after the owner resolves the listed discrepancies (shop number, landmark). */
  address: { text: "1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan", confirmed: false },
} as const;

/** Confirmed phone lines, primary first. Empty until the owner confirms them. */
export function confirmedPhones(): BusinessPhone[] {
  return BUSINESS.phones.filter((p) => p.confirmed).sort((a, b) => Number(b.primary) - Number(a.primary));
}

export const telHref = (p: BusinessPhone) => `tel:${p.e164}`;
