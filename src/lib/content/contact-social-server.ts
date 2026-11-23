import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import {
  CONTACT_SOCIAL_KEY,
  DEFAULT_CONTACT_SOCIAL,
  parseContactSocial,
  type ContactSocialSettings,
} from "./contact-social";

/** Server-only contact/social/WhatsApp settings (store_settings is not anon-readable). */
export const getContactSocial = unstable_cache(
  async (): Promise<ContactSocialSettings> => {
    try {
      const { data } = await createServiceClient()
        .from("store_settings")
        .select("value")
        .eq("key", CONTACT_SOCIAL_KEY)
        .maybeSingle();
      return parseContactSocial(data?.value);
    } catch {
      return { ...DEFAULT_CONTACT_SOCIAL, phones: DEFAULT_CONTACT_SOCIAL.phones.map((p) => ({ ...p })), social: DEFAULT_CONTACT_SOCIAL.social.map((s) => ({ ...s })), whatsapp: { ...DEFAULT_CONTACT_SOCIAL.whatsapp } };
    }
  },
  ["contact-social"],
  { revalidate: 60, tags: ["settings", "contact-social"] },
);
