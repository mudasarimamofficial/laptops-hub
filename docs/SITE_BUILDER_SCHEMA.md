# Site builder schema

**Status:** Draft infrastructure started (Phase 5). Live storefront still renders hardcoded V5 in `src/app/page.tsx`.

## Principles

1. Separate **renderer** (V5 React components) from **merchant content** (DB section instances).
2. Seed defaults from the approved V5 homepage — never replace Production with an empty editor.
3. Draft save ≠ publish. Publish switches `theme_publications` pointer and must respect CMS withdrawal / legal gates.
4. No arbitrary merchant JS/HTML injection as a page builder substitute (`rich_text` uses existing sanitize pipeline when wired).

## Tables (migration `20261025130000`)

| Table | Role |
|---|---|
| `theme_templates` | Named templates (`homepage`, later `product`, `collection`) |
| `theme_versions` | Section JSON snapshots (`draft` / `published` / `archived`) |
| `theme_publications` | Atomic pointer to published version per template key |

## Section registry

Code: `src/lib/content/site-builder-schema.ts`  
Admin editor: `/admin/online-store` → `HomepageSectionEditor`  
API: `GET/PUT /api/admin/theme/homepage` (draft only)

## Publish (not implemented yet)

1. Validate sections against registry + schema_version  
2. Insert immutable published version or promote draft  
3. Update `theme_publications`  
4. Revalidate storefront tags/paths  
5. Audit log  

Owner approval required before Production migration, publish, or storefront switch-over.
