import { createServiceClient } from "@/lib/supabase/server";
import { NOTIFICATIONS_KEY, parseNotificationSettings, type NotificationSettings } from "./settings";

/** Server-only, uncached: notification workers must see a just-saved change. Falls back to the environment. */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const { data, error } = await createServiceClient()
      .from("store_settings")
      .select("value")
      .eq("key", NOTIFICATIONS_KEY)
      .maybeSingle();
    if (error) return parseNotificationSettings(null);
    return parseNotificationSettings(data?.value ?? null);
  } catch {
    return parseNotificationSettings(null);
  }
}
