/**
 * Order of the "Published history" list in the theme editor.
 *
 * `theme_versions.published_at` is the time a version was FIRST published. A rollback makes an older version live again
 * without touching that time, so listing the newest N by `published_at` could drop the version that was live just
 * before the current one (and even the live one) once a store has more than N publications — leaving the merchant no
 * button to restore it. The publish/rollback audit trail says when each version was last live; use it first.
 */
export type PublicationEvent = { liveVersionId: string | null; previousVersionId: string | null };

export function publishedHistoryOrder(
  liveVersionId: string | null,
  eventsNewestFirst: PublicationEvent[],
  byPublishedAtNewestFirst: string[],
  limit = 20,
): string[] {
  const out: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };
  add(liveVersionId);
  for (const e of eventsNewestFirst) {
    add(e.liveVersionId);
    add(e.previousVersionId);
  }
  for (const id of byPublishedAtNewestFirst) add(id);
  return out.slice(0, limit);
}

/** Reads `{ published_version_id, previous_version_id }` from a theme publish/rollback audit row's `after`. */
export function publicationEventFromAudit(after: unknown): PublicationEvent {
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return { liveVersionId: str(a.published_version_id), previousVersionId: str(a.previous_version_id) };
}
