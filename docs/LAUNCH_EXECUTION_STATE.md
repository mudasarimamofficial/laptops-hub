# Launch execution state (Bible ch. 18) — keep this current

**Updated:** 2026-10-24 (PKT) · source brief: `LAUNCH_HUB_ULTIMATE_FULL_LAUNCH_CLAUDE_CODE_BIBLE_2026-10-24.md` (owner's Downloads; not in repo)

## Repository and Production
| Item | Value |
|---|---|
| Production | `main` `700524d` → `dpl_7W2x8QxLKqvcG1iw5WophtRJjhiP` (laptops-hub.vercel.app) |
| DB ledger | 14 applied (read-only check 2026-10-24); nothing pending |
| Switches | COD env **off** · `store_settings.cod_checkout` off · email not configured · `CRON_SECRET` unset · site indexable, no restricted mode |
| Staff | 0 active (test manager deactivated 2026-10-24) · no owner yet · Supabase public sign-up **on** (owner to switch off) |
| Data | 226 active / 6 draft products · 964 photos pending rights · 0 zones · 0 orders · 13 content pages unpublished |

## Release candidate (owner approval needed to merge)
| PR | Branch | Head | Content |
|---|---|---|---|
| **#8** | `release/rc-2026-10-24` | `84ec970` | integration of #4 + #5 + #6 + #7 on `main` `700524d`; no migration/env/content/COD change |
| #4–#7 | feature branches | — | reviewed parts of #8; close when #8 merges |

Evidence (PR #8 comment): isolated journeys 29/29, role HTTP 126/126, checkout 32/32, outbox 13/13, COD concurrency 16/16,
CMS stress 240/240 (1200/1200 on #6), copy gate clean, unit 16/16; Preview (production data, read-only) e2e 41/3 skipped,
copy gate 289 paths clean, no runtime errors.

## P0 done (with evidence, isolated stack unless stated)
- CMS withdraw invariant: stress 1200/1200 consistent views, 100 cycles × 6 parallel, 0 leaks; role HTTP 118/118 ×3 (#6).
- Checkout refuses orders unless the five policies are published + approved: checkout 32/32 (#6).
- Homepage inquiry: see #7 results below.
- Test-fixture production guard: 7 writers refuse with prod env, prod counts unchanged (#4).
- Password recovery: 5/5 journeys with real emails via Mailpit, Preview evidence (#5).

## P0 still actionable without the owner
- The one skipped product-inquiry case in `tests/e2e` → cover on the isolated stack.
- Legal policy HTML drafts with `OWNER TO DECIDE` blanks (internal; never published without approval) — text skeletons
  already in `docs/POLICY_DRAFTS.md`.
- After #8 merges: production read-only verification (NEXT ACTION 1).

## Blocked on the owner (single sheet: `docs/FINAL_LAUNCH_OWNER_INPUTS.md`)
A owner identity + account · B address (shop no., landmark, postcode), primary/WhatsApp line, hours · C zones, courier, fees ·
D legal entity, returns, warranty, legal review of policies · E stock workflow + prices · F photo rights · G email domain,
Resend, Supabase SMTP, CRON_SECRET, who monitors · H public domain · I test-order and go-live approvals.

## Risks / rollback
Instant Rollback to the previous Production deployment; COD kill switch `store_settings.cod_checkout.enabled=false`.

## NEXT ACTION
1. Owner: approve "merge PR #8 into main with a merge commit" → engineering merges, waits for the single Production build,
   runs read-only checks: `tests/e2e` against Production, `node scripts/check-public-copy.mjs https://laptops-hub.vercel.app`,
   HTTP spot checks, runtime errors; records the deployment id here.
2. Owner setup (sheet): owner account + sign-up off; confirm address/phones (then flip `confirmed` flags in
   `src/lib/business.ts` and publish the about/contact drafts); zones; Resend + Supabase SMTP; policy facts.
3. With approval: `node scripts/content/load-drafts.mjs --confirm-production=xvmmjkrkgznnakcobmww` loads the six page
   drafts as DRAFTS (not published) for review in Admin → Content.
