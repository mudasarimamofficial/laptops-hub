# 33 — Current status: three verdicts (2026-11-28)

**This is the single current-status document.** Older status files are dated records:
- `00`, `23`, `31` and `32` carry a banner pointing here;
- where they disagree with this file, this file is correct.

## Verdicts

| Area | Verdict |
|---|---|
| **Engineering readiness** | **PASS (with limits):** everything requested is implemented, tested and deployed. Mobile LCP is still about 4.4–4.6 s in lab runs (L1, doc 35). |
| **Merchant acceptance** | **NOT DONE:** the owner has not yet done the 14-step walkthrough (`36`) or the first real COD order (`37`). |
| **Operational ownership** | **NOT READY:** hosting plan, backups, account custody, media, email ownership, monitoring and repository privacy are all owner decisions (`34`). |

**The project is not certified for live commerce or for client ownership.** Green CI and Vercel builds prove the code,
not the business operation.

## 1. Latest release

| Item | Value |
|---|---|
| `main` (latest code) | `3f9ae6f` (#115); this docs PR lands after it |
| Production deploy | `5eR4MiyoQyp76XuKdiwpXdLPopww` for `3f9ae6f`: success. Read-only check: the `/search?q=dell` heading still shows the V5 default "Results for “dell”". |
| Production database | `xvmmjkrkgznnakcobmww`, **45 migrations applied, none pending** (`supabase migration list --linked`, 2026-11-27). No migration in this pass. |
| PRs this pass | #114 PERF-001 (first collection photo eager + high priority, `42995ad`); #115 editable search results heading (G48); docs PR after them |

## 2. Engineering readiness

**Implemented and live (by area):**
- P0: all fixed.
- P1: 19 of 20 fixed. Only G14 (compare-at price) is a proposal awaiting a design decision (D18).
- G19 content-page history and G22 COD corrections: live, with migrations applied (owner-approved).
- LH-025 ledger repair: done (owner-approved).
- UI hardening VIS-001–008, HYD-001 (checkout hydration) and SEO-001 (`/cart` noindex): live (#107–#113).
- This pass:
  - **PERF-001:** the first collection or search photo is no longer lazy (#114);
  - **search results heading** editable in the theme editor (#115).

**Test evidence:**

| Check | Result |
|---|---|
| Full isolated suite on main + #115 (fresh DB reset, 44 local migrations, machine otherwise idle) | **291 passed / 1 failed / 0 not run, 292 tests, 48.6 min**. The failure was `ui-map-header-compositing` "phones: map first…": `page.goto('/')` timed out (90 s) waiting for the `load` event, which waits on external resources (Shopify CDN images, Google map iframe). Re-running that file with `--repeat-each=3`: **33/33**. Not a product defect, but not an uninterrupted 292/292 pass either. The run's 40 rewritten `docs/evidence/*` files are kept in `.isolated/preserved-run3-evidence-2026-11-28/` and restored in Git. |
| Previous full run (2026-11-27, `4e4daac`) | 275 passed / 3 failed / 8 not run; the 3 files re-ran 15/15. Not an uninterrupted pass. |
| PERF-001 spec | Fails on the old build; 9/9 with the fix (`--repeat-each=3`). Related specs 52/52. |
| Theme publish specs with the new field | 18/18 (`p2b-theme-templates-publish` proves default → draft private → publish → restore) |
| `tsc`, `eslint --quiet`, `npm run test:unit` (63 files) | pass |
| Production read-only after #114 | `/collections/all`: first card eager + high, others lazy, one H1, canonical intact. `/`, collection, PDP, `/search`, `/sitemap.xml`: 200. |
| Production role protection (anonymous, read-only) | `/admin/*` → 307 login; admin APIs 401; cross-site POST 403 |

**Performance (doc 35):**
- Lab mobile medians over 3 runs:

  | Page | Performance | LCP |
  |---|---|---|
  | Home | 64 | 4.49 s |
  | Collection | 66 | 4.35 s |
  | PDP | 61 | 4.63 s |

- PERF-001 removed a 0.3–1.3 s discovery delay on collection pages. The LCP figure did not move, because
  main-thread work (hydration) is now the limit. That is the next engineering task.
- No field (real-user) data exists yet.

**Known limitations, not defects:** `ui-hardening-2026-11-27/12` (L1–L13). Draft PR #62 stays unmerged (diagnostic
only; recommendation in doc 35 §5).

**Unresolved high-priority defects:** none known.

## 3. Merchant acceptance

| Item | State | Guide |
|---|---|---|
| 14-step walkthrough by the owner | **Not done** | `36` (plain-language guide) |
| First genuine COD order: notifications, fulfilment, collection, customer confirmation | **Not done**. The only production order is the engineering test order of 18 Nov 2026. | `37` (supervised checklist) |
| Duplicate product titles (O1), Google Business Profile link (O2), official address (O3) | Owner tasks | `23` |
| G14 compare-at price, theme colour/typography | Owner design decisions (V5 is frozen) | `27`, `32` §6 |

Engineering did not place orders, record cash, publish the production theme or sign in with the owner's account.

## 4. Operational ownership

| Package (`34`) | Today | Decision needed |
|---|---|---|
| A Hosting | Vercel **Hobby** (non-commercial) | Vercel Pro on a client team (about $20/month) |
| B Backups | Supabase Free; no automatic backups; dump/restore proven on the local stack only | Supabase Pro (about $25/month) and/or an encrypted scheduled export |
| C Accounts | GitHub, Vercel and Supabase are owned by engineering accounts | Transfer to client accounts, in a freeze window |
| D Media | 964/964 product photos hot-linked from Shopify's CDN | Rights decision, then phased copy-and-switch |
| E Email | Resend account owner and domain verification not inspected | Client-owned Resend; DNS records need approval |
| F Monitoring | None | Free uptime monitor + an incident page |
| G Repository | **PUBLIC**; old test-order text in Git history | Make it private before the transfer |

## 5. What engineering will not do without written approval

- production data changes, new migrations, financial records or COD policy;
- customer emails, purchases or plan upgrades;
- credential rotation, account, repository or domain transfers, DNS;
- repository visibility, bulk media migration;
- publishing unapproved legal or commercial content.

The Hostinger CRM (`app.laptopshub.pk`) is never touched.
