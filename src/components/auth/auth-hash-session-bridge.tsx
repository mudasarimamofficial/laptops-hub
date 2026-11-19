"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESET_PASSWORD_PATH } from "@/lib/auth/recovery";

/**
 * Native Supabase Auth SMTP / default-template links land on Site URL with
 * `#access_token=…&refresh_token=…&type=recovery|invite`. The admin reset form
 * needs those tokens in cookies (server `getSession`), so exchange the hash
 * once, strip it from the URL, then hard-navigate to the reset form.
 */
export function AuthHashSessionBridge() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;

    const params = new URLSearchParams(raw);
    const type = params.get("type");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;
    if (type !== "recovery" && type !== "invite") return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      if (cancelled || error) return;
      window.location.replace(RESET_PASSWORD_PATH);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
