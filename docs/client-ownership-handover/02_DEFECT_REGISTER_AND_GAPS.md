# 02 — Independent defect register and merchant-control gaps (2026-11-24)

Audit baseline: production `dpl_m8iVeF98uAGhsyL8SGJbK2R8hzKc` @ `fc24550` (verified READY, aliases www + apex).
Severity: **P0** security/financial/owner access · **P1** broken merchant operation or major missing customization ·
**P2** important usability/ops/security hardening · **P3** polish.
Status: **FIXED (this release)** · **OPEN** · **OWNER** (business/account decision) · **MITIGATED**.

Older registers (`docs/final-independent-audit/15_MASTER_DEFECT_REGISTER.md`) are superseded where an item appears here.

| ID | Sev | Area | Finding (verified) | Status | Evidence / fix |
|---|---|---|---|---|---|
| LH-001 | P1 | Theme editor | Publishing in Admin → Online Store had **no effect on the live site**: the homepage read published themes only when the env var `THEME_PUBLISHED_ENABLED=1`, which is not set in Vercel Production. Production DB: 2 draft rows, **0 publications** ever. A merchant could not make an edit live without a developer. | FIXED | Publication is now the merchant's switch. `THEME_PUBLISHED_DISABLED=1` remains as a developer emergency switch. With 0 publications, the deploy changes nothing for customers until the merchant presses Publish. `src/lib/content/published-homepage.ts` |
| LH-002 | P1 | Theme editor | 10 of 13 homepage sections had **no editable text**: every heading, kicker, intro, button label and button link was hard-coded JSX. | FIXED | 46 typed copy fields across 11 sections with approved V5 defaults, placeholders, per-field Reset, length caps and safe-link validation (client + server). `src/lib/content/home-copy.ts` |
| LH-003 | P2 | Theme editor | A stale editor tab silently overwrote a newer draft saved by another staff member. | FIXED | Draft fingerprint (optimistic concurrency): save returns 409 `draft_conflict`; the editor asks before overwriting. |
| LH-004 | P2 | Homepage | "Or call Laptops HUB" in the homepage inquiry read a hard-coded constant (all numbers `confirmed:false`), so it never showed and ignored Admin → Settings → Contact & social. | FIXED | Uses the same Settings phone list as the footer. **Visible change:** the three public phone numbers now appear under the inquiry form. |
| LH-005 | P2 | Homepage | Product story showed the hard-coded line "Core i5-1145G7 · 11th gen" for any product that matched the hero main handle, so a merchant-chosen laptop could show the wrong processor. | FIXED | Cleaned line only for the original V5 Dell listing. |
| LH-006 | P2 | Security headers | Live responses lack `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By: Next.js` exposed. | FIXED | `next.config.ts` baseline headers, `poweredByHeader:false`. |
| LH-007 | P2 | Security headers | No Content-Security-Policy. | OPEN | Needs a report-only rollout tested against Google Maps embed, external reel video hosts and Shopify CDN images. |
| LH-008 | P1 | Theme editor scope | No multi-template editor: product page, collection, search, cart, compare, blog, content-page and 404 templates, global theme settings (colors/typography/buttons), header/footer copy and the mega-menu are not editable without code. | OPEN | Phase 2 plan in `05_THEME_EDITOR_SPEC_AND_ACCEPTANCE.md`. Homepage is complete. |
| LH-009 | P2 | Navigation | Header behaviours depend on link label text ("Guides" hidden when no guides; "Support" href overridden): renaming those links in Admin → Navigation breaks them. Mobile drawer ignores the Navigation settings; mega-menu groups are code-defined. | OPEN | `src/components/storefront/site-header.tsx` |
| LH-010 | P2 | SEO | SEO defaults saved in Admin → Settings (`seo_defaults`) are never read; site title/description are hard-coded in the storefront layout. | OPEN | `src/app/(storefront)/layout.tsx` |
| LH-011 | P2 | Theme editor | `rich_text` and `image_banner` exist in the registry but render nothing and cannot be added. | OPEN | Hidden from the editor's add flow (there is none); safe. |
| LH-012 | P2 | Footer / content | Footer tagline, "Visit & contact", WhatsApp link label, content-page kicker/intro, guides index copy, 404 copy, checkout/cart microcopy are code-only. | OPEN | Phase 2 (global/footer settings, page templates). |
| LH-013 | P2 | Dev operations | This workstation keeps **production** Supabase keys in `.env.production.local`. Next.js gives that file priority over `.env.local` in `next build`/`next start`, so a "local" production build silently targets the production database. Caught during this audit before any write (401, verified 0 production writes). | MITIGATED | New `scripts/dev/isolated-next.mjs` forces `.env.local` and refuses non-local Supabase. Owner action: delete `.env.production.local` (pull env from Vercel only when needed). |
| LH-014 | P1 | Hosting compliance | Vercel team `team_l7hth478q4bLcmoKR21X7uqm` is on the **Hobby** plan, which Vercel restricts to non-commercial use. A revenue-generating store should not be certified on it. | OWNER | See `09_FREE_TIER_COST_RISK.md`. No change made. |
| LH-015 | P2 | GitHub | `main` has **no branch protection**; Dependabot alerts are disabled; repository is **public**. | OWNER | Repo settings; recommendations in `11_GITHUB_OWNERSHIP_TRANSFER.md`. |
| LH-016 | P2 | Auth | Supabase leaked-password protection disabled (prior advisor finding, not re-checked in dashboard this pass). | OWNER | Dashboard toggle; free. |
| LH-018 | P3 | Homepage hero | Once a theme is published, the stored default hero image URLs count as merchant overrides: if a default hero listing (e.g. the HP ProBook 640 G2) is later removed, its slot would show the HP preset photo linked to a different product. Production has all three default listings today. | OPEN | `resolveHeroPresentationImage` in `src/lib/content/homepage-image-presets.ts` |
| LH-019 | P3 | Tests | Isolated test "editor can draft a Google review without a Maps link" fails: UI shows "Could not save". Pre-existing; not touched by this release. | OPEN | `tests/e2e-isolated/p1-store-testimonials-map.spec.ts:92` |
| LH-017 | — | COD | Live COD ordering is a business gate (not a defect). Vercel has `COD_CHECKOUT_ENABLED` set; the DB setting `cod_checkout` controls go-live. Not changed. | OWNER | Activation needs the owner's written shipping/fee/returns policy. |

## Not re-verified in this pass (honest scope)
Full 20-width visual matrix, Lighthouse/NO_LCP re-measurement, screen-reader session, every admin module's
create/edit/delete cycle, RLS matrix re-run, backup restore drill. Earlier evidence exists in `docs/` (dated) and is
listed in `18_FINAL_PRODUCTION_EVIDENCE.md`, but it was not repeated here.
