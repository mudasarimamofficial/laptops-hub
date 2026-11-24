import { createHash } from "node:crypto";

/**
 * Stable fingerprint of a stored theme draft's `sections` (jsonb). Postgres returns jsonb objects with a canonical key
 * order, so two reads of the same stored value always serialize identically. Used for optimistic concurrency in the
 * theme editor: the editor sends back the fingerprint it loaded, and the save is refused if the draft changed since.
 */
export function draftFingerprint(sections: unknown): string {
  if (sections == null) return "none";
  return createHash("sha256").update(JSON.stringify(sections)).digest("hex").slice(0, 32);
}

/**
 * Fingerprint of the whole draft state. With empty theme_settings it equals `draftFingerprint(sections)`, so editors
 * opened before site-wide copy existed keep matching.
 */
export function draftStateFingerprint(sections: unknown, themeSettings: unknown): string {
  const empty =
    themeSettings == null ||
    (typeof themeSettings === "object" && !Array.isArray(themeSettings) && Object.keys(themeSettings as object).length === 0);
  return empty ? draftFingerprint(sections) : draftFingerprint([sections, themeSettings]);
}
