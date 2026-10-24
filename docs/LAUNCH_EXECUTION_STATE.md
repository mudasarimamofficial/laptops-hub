# Launch execution state (Bible ch. 18) — keep this current

**Updated:** 2026-10-24 (PKT) · source brief: `LAUNCH_HUB_ULTIMATE_FULL_LAUNCH_CLAUDE_CODE_BIBLE_2026-10-24.md` (owner's Downloads; not in repo)

## Repository and Production
| Item | Value |
|---|---|
| Production | `main` `3995c0f` (PR #8) → `dpl_EKC4j17SAaEY2SDh6df5gVf4w3AV` (laptops-hub.vercel.app), deployed 2026-10-24, one build; rollback: `dpl_7W2x8QxLKqvcG1iw5WophtRJjhiP` (`700524d`) |
| DB ledger | 14 applied (read-only check 2026-10-24); nothing pending |
| Switches | COD env **off** · `store_settings.cod_checkout` off · email not configured · `CRON_SECRET` unset · site indexable, no restricted mode |
| Staff | 0 active (test manager deactivated 2026-10-24) · no owner yet · Supabase public sign-up **on** (owner to switch off) |
| Data | 226 active / 6 draft products · 964 photos pending rights · 0 zones · 0 orders · 13 content pages unpublished |

## Release 2026-10-24 — DEPLOYED (owner-approved merge of PR #8)
| Check (Production, read-only) | Result |
|---|---|
| Merge | PR #8 → `3995c0f` (merge commit); `main` tree = RC tree; #4, #5, #6 auto-marked merged; #7 closed unmerged (owner-approved; all commits in `main`) |
| Deployment | `dpl_EKC4j17SAaEY2SDh6df5gVf4w3AV`, single Production build |
| HTTP | `/`, collections, PDP, track-order, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` 200 · `/admin`, `/admin/inquiries` 307 · content pages and `/guides` 404 (unpublished) · checkout POST 403 `checkout_disabled` · cron 503 (no secret) |
| Homepage | inquiry section present ("Tell us what you're looking for.") |
| SEO | home `index, follow`; 404 pages `noindex` only; sitemap 267 URLs, no unpublished content |
| `tests/e2e` | 41 passed, 2 skipped (need published content) |
| Copy gate | 289 paths, no unfinished copy, no broken links |
| Security | P0 9/9 · auth matrix 24/24 |
| Runtime errors | none |
| Unchanged | no env, secret, COD, content or account change |

## P0 done (with evidence, isolated stack unless stated)
- CMS withdraw invariant: stress 1200/1200 consistent views, 100 cycles × 6 parallel, 0 leaks; role HTTP 118/118 ×3 (#6).
- Checkout refuses orders unless the five policies are published + approved: checkout 32/32 (#6).
- Homepage inquiry: see #7 results below.
- Test-fixture production guard: 7 writers refuse with prod env, prod counts unchanged (#4).
- Password recovery: 5/5 journeys with real emails via Mailpit, Preview evidence (#5).

## P0 still actionable without the owner
- (done) product inquiry dialog journey covered on the isolated stack (inquiry spec 7/7).
- Legal policy HTML drafts with `OWNER TO DECIDE` blanks (internal; never published without approval) — text skeletons
  already in `docs/POLICY_DRAFTS.md`.
- After #8 merges: production read-only verification (NEXT ACTION 1).

## Blocked on the owner (single sheet: `docs/FINAL_LAUNCH_OWNER_INPUTS.md`)
A owner identity + account · B address (shop no., landmark, postcode), primary/WhatsApp line, hours · C zones, courier, fees ·
D legal entity, returns, warranty, legal review of policies · E stock workflow + prices · F photo rights · G email domain,
Resend, Supabase SMTP, CRON_SECRET, who monitors · H public domain · I test-order and go-live approvals.

## Risks / rollback
Instant Rollback to the previous Production deployment; COD kill switch `store_settings.cod_checkout.enabled=false`.

## Current step (2026-10-24): owner account activation (sheet item A)
Verified read-only before handing over: Production `3995c0f` / `dpl_EKC4j17SAaEY2SDh6df5gVf4w3AV`; ledger 14, nothing
pending; 1 auth user (the deactivated test account), 0 active memberships; public sign-up ON; 0 zones; 0 orders; 0 inquiries;
0/13 pages published; COD off. Verified read-only after the owner's report: owner membership OK (gmail.com user, role owner, active, confirmed; only
active owner/admin; test manager inactive). Owner sign-in verified (last_sign_in_at 2026-10-24 16:20 UTC). STILL OPEN: Supabase auth settings report public
sign-up allowed (disable_signup=false, rechecked 4× over 1 minute after the owner's save, uncached) — owner to recheck.
Next: shipping zones (sheet item C) once the owner can sign in.

## NEXT ACTION
1. Owner setup (sheet A–I): owner account + sign-up off; confirm address/phones/hours (then set `confirmed` in
   `src/lib/business.ts` via a small PR and publish About/Contact); shipping zones; Resend + Supabase SMTP + redirect
   URL; policy facts and legal approval; prices; photo rights.
2. With approval: `node scripts/content/load-drafts.mjs --confirm-production=xvmmjkrkgznnakcobmww` loads the six page
   drafts as DRAFTS (not published) for review in Admin → Content.
3. Then: email/cron variables (approval) → Scenario A test order (approval) → go-live sign-off → COD activation (approval).
