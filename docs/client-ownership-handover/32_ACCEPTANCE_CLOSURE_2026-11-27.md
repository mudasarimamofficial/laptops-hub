# 32 — Acceptance-matrix closure and owner readiness (2026-11-27)

**Status: READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED.** This is not a handover certificate. The
merchant's own usability check (check 12 in `29`), one verified real order (D4), infrastructure ownership (D1, D2, D9)
and the G19 production migration (D16) are still open.
*(Updated 2026-11-28: D16/G19 was applied later the same day, see §3; current status in `33`.)*

Everything below was proven on the **isolated** stack (local Supabase, local fake mail, a production build served by
`scripts/dev/isolated-next.mjs`) unless a line says "production, read-only". No production data or schema was changed
in this pass.

> **2026-11-27 evening addendum (UI hardening close-out):** see `ui-hardening-2026-11-27/` (00–12).
> - #107–#111 are live (VIS-001 to VIS-008, plus the filter accessibility fix).
> - Full isolated run on `4e4daac`: 275 passed / 3 failed / 8 not run. Re-running those files: 15/15. No product cause (`ui-hardening-2026-11-27/10`).
> - New: HYD-001 (checkout hydration mismatch) and SEO-001 (`/cart` noindex), fixed in the PR listed in `ui-hardening-2026-11-27/11`.
> - The owner walkthrough (§5), D19, D1/D2/D9, D4 and D17 are unchanged and still open.

## 1. Three separate states

| Area | State | What would change it |
|---|---|---|
| **Engineering completion** | Every gap in the brief's priority list has code and browser evidence, or is documented as not built (§6 theme controls, G14). | — |
| **Merchant acceptance** | **Not done.** Check 12 ("understandable without docs") is **R** on every row of `29`. Automated specs cannot judge clarity. | The owner performs the walkthrough in §5 personally and signs it off. |
| **Third-party platform readiness** | **Not certified.** GitHub repo is still **public** (D9/D19). Vercel, Supabase and the domain are not yet in client-owned accounts (D1, D2). COD go-live is an owner decision (D4) with no verified real order. | Owner decisions in `23`, executed with `11`. |

## 2. What changed in this pass (PRs, merge commits, Vercel production deploys)

| PR | Change | Merge commit | Vercel production deploy |
|---|---|---|---|
| #99 | Navigation editor G26/G49 | `e217d2c` | `87aWGNkwzRy4GDEU8dQjFrSk4dda` success |
| #100 | Product import safety + import/SEO E2E | `3aad73a` | `8xTu2zQJD4mifShZWkBtK1B8wkkc` success |
| #101 | Role UX G27/G28 | `177983d` | `5afcZXijcSH11srLQx1u6oHApSzB` success |
| #102 | Checkout quote race (root cause of the "flaky" quote check) | `a0d6d31` | `5GkLTMi84sDyNLRNe9LCXbydga4H` success |
| #103 | Activity log search and filters | `e10889f` | `2q8pWKZm62KTNFRDLENe657twkqU` success |
| #104 | G41/G45 admin accuracy (COD text, Help, media wording) | `7f8defb` | `BpwGdL71c38sYn1eBaZo1d64mvUo` success |
| #105 | Test only: discount propagation E2E | `ed327db` | test-only (no app change) |
| #91 | G19 content-page history/restore/SEO (after migration, owner-approved) | `365a0a1` | `AAA71VDtgNrrRneV7dybhy4VPK7X` success |

Production read-only smoke after the merges:
- `/`, `/cart`, `/guides`, `/sitemap.xml` and `/pages/privacy` all return 200.
- `/admin/help` and `/admin/activity` return 307 (sent to sign-in).
- An anonymous request to `/api/admin/navigation` returns 401.

## 3. Defects found and fixed this pass (real, not test changes)

| Defect | Found by | Fix |
|---|---|---|
| Header and footer menus could fall out of sync; an emptied menu silently came back as the defaults; the Support link vanished when the FAQ was unpublished, or overrode a re-pointed link | Navigation spec | #99 |
| 8 header links pushed the cart icon off-screen | Navigation spec (1180–1440 px) | #99, with a width warning in the editor |
| A navigation save could overwrite a newer save from another tab | Navigation spec | #99 compare-and-swap; 409 "out of date" with Reload |
| Server CSV parser broke on quoted commas and new lines | Import spec | #100 one RFC 4180 parser |
| "Update by handle" blanked fields that were empty in the CSV and reset stock | Import spec | #100: only filled columns are changed; stock is kept |
| A production commit was possible without the dry-run preview | Import spec | #100 `preview_required` |
| Editors saw Publish/Restore and then got 403; sidebar links did not match page access | Role spec + audit script | #101 (no permissions widened; G47 kept) |
| **Checkout quote race:** a slow answer for an earlier address could replace the answer for the current one, showing fees for the wrong place | New race spec (old code 0/5, fixed 5/5) | #102 cancels and ignores stale answers |
| Activity log could not be searched and showed staff as id fragments | Brief | #103 |
| Overview said "COD is live" and Help said "COD stays off", both hard-coded; the COD gate's "fix" link pointed to Settings, which has no such control (G41) | Brief / `22` | #104 |
| Media page claimed pending-rights images are hidden from customers; the storefront does not filter by rights (G45) | Code check | #104 wording corrected |

## 4. Migrations and approvals

**Production migrations applied** (all with owner approval): LH-025 ledger repair (`20261126022136`) and G22 (`20261126140000`) in earlier passes; **G19 (`20261126160000`) on 2026-11-27 at 10:52 UTC**, after the owner replied "Authorise G19" in chat. The record is in `26` §G19-10.

**Pending:** none. Before execution, G19's preflight was complete (`26` §G19-7 to §G19-9, on the PR #91 branch):
- Old code 25/25 and new code 34/34 on the isolated stack.
- Role HTTP matrix 126/126.
- Merged code typecheck and unit tests pass.

The release order below was executed on 2026-11-27, steps 1–7. Step 8, the owner's UI check, is still to do.

**Release order after the owner authorises it:**
1. `npx supabase migration list --linked` must show only `20261126160000` pending.
2. Run the md5 pre-check of `content_pages` (read-only).
3. **The write:** `npx supabase db push --linked`.
4. Run the post-checks in `26` §G19-4.
5. Mark PR #91 ready, then `gh pr merge 91 --merge`.
6. Wait for Vercel READY.
7. Run the read-only live check.
8. Owner UI acceptance.

No content edits between steps 3 and 5. Legal policy content is not published or rewritten as part of this.

**Owner-only approvals still open:**
- D18 (G14 compare-at price display; proposal only).
- D17 (Shopify-hosted media).
- D19 (repository visibility and LH-025 evidence custody, §7).
- D4 (COD go-live and one verified real order).
- D1, D2, D9 (ownership transfer).
- Any colour or typography change to the frozen V5 design (§6).

## 5. Owner walkthrough (the 14 routine operations)

The owner does this **personally**. Engineering does not perform production-changing walkthroughs with the owner's account.

**Doing it safely on the live store:**
- Use a new **draft** product named "Walkthrough test", and delete it at the end.
- Use a draft blog guide.
- Create a backup before you start.
- Record a COD collection **only** on a real order whose cash was really received.

For each step, note whether it was clear without help (yes or no, and what was confusing). That note is check 12 in `29`.

| # | Operation | Where | What to check | Automated proof (isolated) |
|---|---|---|---|---|
| 1 | Add a laptop with variants and specifications | Products → Add product | Draft stays hidden; variants each have price and stock; specs show on the product page after publishing | `p0-variant-order-journey`, `p0-product-specs-edit`, `z-owner-acceptance` 1–9 |
| 2 | Upload and reorder its photos | Product → Media | Alt text saves; the first photo is the main one on the storefront | `p1-product-media-g13` (4) |
| 3 | Edit its SEO fields | Product → Search appearance | Title and description appear in the page source and Google preview | `p1-product-import-seo` (4), `seo-search-appearance` (7) |
| 4 | Add and manage a collection | Collections | Manual picks and rules; order is kept; collection page shows the products | `p1-collection-modes-g12` (5), `p0-collection-management` (3) |
| 5 | Update homepage content | Customize | Edit draft → Preview → Publish; Restore an older version | `p1-theme-copy-publish` (4), `p1-theme-ordering-preview` (6) |
| 6 | Change navigation | Navigation | Rename a link, save, check header + phone menu + footer; restore the previous version | `p1-navigation-editor-g26-g49` (5) |
| 7 | Create a blog guide | Content → Blog | Draft is not public; publish shows it under Guides and in the sitemap | `p1-reels-reviews-blog`, `p1-backup-v3-blog-taxonomy` |
| 8 | Review an order | Orders → an order | Items, variant, delivery fee and total match what the customer saw | `launch-journey` (10) |
| 9 | Record a legitimate COD collection | Order → Record collection | Only on a delivered order with cash received; a correction is a new entry, not an edit | `p1-cod-ledger-g22` (3) |
| 10 | Handle an inquiry | Inquiries | Change status, add a note | `home-inquiry` (5) |
| 11 | Change contact information | Settings → Contact & social | Footer, WhatsApp button and inquiry phones update | `contact-social-admin-persist` (2) |
| 12 | Manage notifications | Settings → Notifications | Send a test to staff only; customer email stays off unless the owner chooses | `p1-notifications-g24` (6) |
| 13 | Create and verify a CMS backup | Settings → Backups | Create, download, and read the summary; do not restore on the live store unless needed | `p1-backup-restore-cod-gate`, `p1-backup-v3-blog-taxonomy` |
| 14 | Edit and restore a theme draft | Customize | Change a text, save draft, preview, discard or restore | `p1-theme-copy-publish`, `p2-theme-globals-publish` (3) |

Afterwards, search the activity log (Settings → Activity) for "walkthrough" or the owner's email to confirm every step was recorded.

## 6. Theme editor: remaining controls (assessment, not built)

**What the editor already covers:**
- Homepage: section order, visibility, 46 copy fields, images, and product picks.
- Site-wide text in 8 groups:
  - header: 6;
  - footer: 3;
  - announcement: 2;
  - product page: 11;
  - collection page: 8;
  - not found: 6;
  - cart: 10;
  - compare: 6.
- Product-page layout: section order, visibility, and the related-products count.
- Draft, preview, publish and restore for all of the above.

| Requested control | State | Note |
|---|---|---|
| Collection-page layout and preview | Copy only (8 fields); no layout options | Could reuse the product-layout pattern (stored in `store_settings`, **no migration**). Medium effort. |
| Content-page presentation, blog template choices | Not editable | Content pages are edited in Content (G19 adds SEO and history once approved). Template choices are a design decision (V5 frozen). |
| Search UI labels | Header search box texts editable; search results page wording not | Small, same `globals` pattern (G48). |
| Reviews block wording | Homepage reviews heading and intro editable; product-page reviews wording not | Small (G48). The G29 length limits are still open. |
| Buy-box microcopy | Buy button text in Settings; the rest is code | Small, but checkout and policy wording **needs owner content**. Pricing, availability, discount and stock logic stay out of the editor by design. |
| Colour and typography presets | Not built | **Conflicts with the frozen V5 design system.** Owner decision before any work. |
| Responsive spacing | Not built | Same: design-system change. |
| Global vs template clarity | Panels are labelled "Site-wide text" vs "Homepage" vs "Product page" | Check 12 for the owner. |
| Preview fidelity | Draft preview does not show the header and footer (known) | Small-to-medium fix. |

None of these needs a database migration. If one ever does, it gets its own approval.

## 7. D19: repository visibility and evidence custody (steps for the owner)

**Current state (checked 2026-11-27):**
- `mudasarimamofficial/laptops-hub` is **PUBLIC**.
- Current files hold no personal data of the test order (`28` §2).
- Old text remains reachable in Git history and cached GitHub views.
- No keys or passwords were found in history (`28` §1).

**Recommended steps.** The owner decides; engineering does not change visibility without approval.

1. **Make the repository private:** GitHub → repository → Settings → General → Danger Zone → Change visibility → Private.
   - Vercel keeps deploying: the Git integration works with private repositories on the same account.
   - Forks and stars of a public repository are lost on the change; there are none (0 forks and 0 stars on 2026-11-27).
2. **Confirm Vercel still deploys:** after the change, merge a docs-only PR and check that the "Vercel" commit status is success.
3. **Ask GitHub to purge cached views** only if a specific old page with personal data is still reachable. Use GitHub Support → "Remove sensitive data", naming the commit URLs from `28` §2.
   - History rewriting (`git filter-repo`) is **not** recommended. It breaks every PR link and the deployment history, and making the repository private already contains the exposure.
4. **Copy the LH-025 private evidence** to client-controlled encrypted storage:
   - Source: `C:\Users\mudas\Documents\LaptopsHub-private\lh025-*-2026-11-26\` on the engineering workstation.
   - Destination: for example an encrypted archive in the owner's Google Drive.
   - The owner confirms receipt; then the workstation copy can be deleted on the owner's instruction.
   - Never commit its content.
5. **Ownership transfer (D9 / `11`)** moves the repository to the client's GitHub account. Do step 1 first, so the transfer happens on a private repository.

## 8. Test evidence (this pass)

| Spec / check | Result |
|---|---|
| `p1-navigation-editor-g26-g49` | 5 tests pass |
| `p1-product-import-seo` + unit `shopify-csv-parse` | 4 tests pass; unit OK |
| `p1-role-ux-g27-g28` | 3 tests pass |
| `p0-checkout-quote-race` | Old code 0/5, fixed code 5/5 |
| `p1-activity-search` | 4/4 (`--repeat-each=2`) |
| `p1-admin-accuracy-g41-g45` + regressions (`p0-admin-isolation-and-checkout-gates`, `p1-product-media-g13`, `p1-role-ux-g27-g28`) | 19/19 |
| `p1-discount-propagation` | 2/2 (`--repeat-each=2`) |
| Role HTTP matrix (`scripts/security-role-http-isolated.mjs`) | 126/126 |
| Sidebar vs page role audit (all admin routes, role constants resolved) | No mismatch |
| `npm run test:unit`, `tsc --noEmit`, `eslint --quiet` | Pass / clean |
| SEO | Imported product SEO reaches the public page: title, description, canonical, OG image, and Product JSON-LD with the active price; drafts are not public (`p1-product-import-seo`). The discount price reaches the product page (`p1-discount-propagation`). `seo-search-appearance` was not re-run this pass. No SEO regression was found in the specs that ran. |

**Not run this pass:** a full uninterrupted isolated suite after all merges. The last full baseline is in `29` (2026-11-26). The one flaky check in it is now explained and fixed (#102).
