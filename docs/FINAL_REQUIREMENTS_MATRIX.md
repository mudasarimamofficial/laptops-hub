# Final requirements matrix — release 2026-11-16

Status legend: **PASS** (done and verified with evidence) · **BLOCKED** (needs an owner decision/approval) ·
**NOT DONE** (engineering work not done) · **N/A**.

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 1–3 | Read authoritative docs; preserve work (tags, backup ref, stash, client HTML, untracked files) | PASS | Tags `baseline/2026-11-14-pre-guardian`, `checkpoint/2026-11-15-pre-closeout`, ref `refs/backup/2026-11-16-session-start`; untracked owner files left in place, not committed |
| 5 | Full-bleed two-row reviews marquee (100% width, no 100vw overflow) | PASS | E2E widths 320–1440, no horizontal overflow; cross-browser 5/5 |
| 5 | Pause/play, dialog, reduced motion, offscreen pause, accessible clones | PASS | E2E `p1-store-testimonials-map`, `cross-browser-home-sections` |
| 6 | Admin testimonials: provenance, consent, avatar permission, draft→approve→publish/hide, reorder (display order), placement, audit history | PASS | E2E, SQL matrix 19/19, unit |
| 6 | No false Google attribution; no hard-coded 4.9/157; no fake entries | PASS | Google mark only with a verified Google link; unit grep; nothing imported from the HTML |
| 6 | Placement configurable in theme editor | PASS | `v5_store_reviews.placement` (3 positions) |
| 6.6 | Tests (create→hidden draft→approve→shown→unpublish→removed; editor cannot approve; HTML as text; long text; dialog; pause) | PASS | 5 isolated + 5 cross-browser tests |
| 7 | Map after footer with footer-underlay reveal, supplied embed, lazy, reduced motion, mobile, no scroll hijack, no CLS/overflow | PASS | CSS sticky underlay; sentinel IO; E2E; browser check mid-scroll |
| 7 | Theme-editor configurable, safe iframe sources only, homepage only | PASS | `v5_store_map`; validator + API 400; absent on `/products` |
| 8 | Admin p50/p75/p95 for 18 journeys; fix real latency | PASS (modelled) / live authenticated NOT DONE | Modelled 1 753 → 365 ms; live unauthenticated `/admin` 103 ms p50; authenticated needs a staff sign-in |
| 9 | Product checkbox bulk selection | PASS | E2E `p1-product-bulk-select` |
| 10 | Commerce regression incl. PKR 360 + 50 and free shipping | PASS (isolated) | final suite: shipping/COD SQL matrix, COD checkout, concurrency, inventory |
| 11 | Migration 28 + order verified; backup; restore rehearsal; 14→final; compatibility | PASS | `MIGRATION_VERIFICATION.md` — real production backup restored and upgraded; identical schema |
| 11 | Apply production migrations | PASS | Owner-approved 2026-11-16; fresh backup; 29/29; post-checks in `docs/evidence/migrations/prod_apply_2026-11-16.txt` |
| 12 | DNS/CRM safety; email records verified | PASS (no changes made) | `app.laptopshub.pk` → Hostinger, untouched. **No MX/SPF/DMARC/DKIM** — owner action |
| 13–14 | Writable isolated staging; 50-step acceptance | PASS (isolated local stack); hosted staging BLOCKED | No paid resources created; a hosted writable staging would need a second Supabase project (paid decision) |
| 15–18 | Route QA, cross-browser, 320–1920 widths, SEO/a11y/perf | PASS (isolated) | final suite cross-browser; live baseline 267/267 sitemap URLs 200 |
| 19 | Push branch, PR to main, Vercel mapping; no force-push | PASS | Fast-forward push `cb638b7..dc0180b`; PR #10; Preview only, sin1. `main` has no branch protection (merge deploys) |
| 20 | Safe production deploy | PASS | Migrations first, then PR #10 merged → `772276b`, sin1 |
| 21 | COD stays disabled without business approvals | PASS | Not changed |
| 22–23 | Live QA and fix loop | PASS (public) / NOT DONE (authenticated admin) | `LIVE_QA_REPORT.md`; no live defects found |
| 24 | 15 documents | PASS | `docs/FINAL_*`, `ADMIN_PERFORMANCE_REPORT`, `GOOGLE_REVIEWS_IMPLEMENTATION`, `MAP_REVEAL_IMPLEMENTATION`, `MIGRATION_VERIFICATION`, `PRODUCTION_*`, `MERCHANT_ADMIN_HANDBOOK`, `CLIENT_ACCEPTANCE_CHECKLIST` |
