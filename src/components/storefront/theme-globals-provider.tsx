"use client";

import { createContext, useContext } from "react";
import { DEFAULT_THEME_GLOBALS, type ThemeGlobals } from "@/lib/content/theme-globals";

/**
 * Published site-wide copy (theme editor › Site-wide text) for client-rendered storefront pieces: cart page, cart
 * panel and compare page. Without a provider the V5 defaults are used, so the text never goes missing.
 */
const GlobalsCtx = createContext<ThemeGlobals>(DEFAULT_THEME_GLOBALS);

export function ThemeGlobalsProvider({ globals, children }: { globals: ThemeGlobals; children: React.ReactNode }) {
  return <GlobalsCtx.Provider value={globals}>{children}</GlobalsCtx.Provider>;
}

export function useThemeGlobals(): ThemeGlobals {
  return useContext(GlobalsCtx);
}
