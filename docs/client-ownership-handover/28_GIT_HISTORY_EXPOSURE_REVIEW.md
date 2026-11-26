# 28 — Public Git history and PR evidence review (2026-11-26)

The repository `mudasarimamofficial/laptops-hub` is **public** (decision D9 in `23`). This review looked for sensitive
material in the current files, all of Git history (`git log --all -p`) and the 94 pull-request descriptions.
Values are never repeated here.

## 1. What was searched

| Search | Result |
|---|---|
| Provider tokens across all history: Resend `re_…`, Stripe-style `sk_live_`, GitHub `ghp_`/`github_pat_`, Vercel, Supabase access `sbp_`, Supabase `sb_secret_` | **None real.** Matches were identifiers such as `re_testimonials_…`, `re_shipping_restocks` and the local placeholder `sb_secret_localdemo`. |
| JWTs (`eyJhbGciOi…`) across all history | One commit (`cb638b7`, 2026-10-26) has a JWT whose issuer is `supabase-demo`: the published Supabase **local** demo key, not a production key. |
| `.env*`, `owner.json`, signed-in browser state (`.auth/`, storage-state files) across all history | Only `.env.example`, which holds empty or placeholder values. No browser session state was ever committed. |
| Production project reference | Present in 54 commits. It is not a secret (it is in every public page's JavaScript); access is controlled by keys, which were not found. |
| Email addresses in current files | The business contact address appears in code, tests and docs. It is published on the live site (Contact & Social), so this is expected. |
| Personal data in current files | **Found and redacted** (section 2). |
| PR descriptions (94) | Only the published business address. No personal data or keys. PR comments and CI logs were not reviewed. |
| Commit `53c1c8a` (2026-11-26) | An over-staged commit replaced by `87c864d` before merge, but it is still reachable on GitHub by its hash. It adds public-page screenshots, Lighthouse reports of public pages and docs. **No keys or personal data.** It does **not** contain the LH-025 private evidence. |

## 2. Exposure found and contained

| Where | What | Containment (this branch) |
|---|---|---|
| `docs/PRODUCTION_ORDER_AND_OWNER_VERIFICATION_2026-11-18.md` (since PR #38/#39, 2026-11-18) | The 18 Nov QA test order's buyer name, a staff member's personal mailbox, a mobile number, postcode and landmark, and full order/user ids | Redacted in the current file |
| `docs/FINAL_PRODUCTION_CERTIFICATION.md` | The same staff mailbox (twice) | Redacted |

**Limits of containment.** The old text remains in Git history and in GitHub's cached commit views. A history rewrite
and force-push would **not** guarantee removal: clones, forks, cached views and commit hashes such as `53c1c8a` can
stay reachable. Nothing was force-pushed. The data concerns the engineering team's own test order (no customer). It
includes no passwords, keys or payment data.

Owner options (part of D9):
- (a) Make the repository private. This is the strongest step.
- (b) If the staff member asks, contact GitHub Support for removal of cached views after a history rewrite.
- (c) Accept the current redaction.

## 3. Prevention added

`.gitignore` now also ignores:
- `owner.json`, `**/.auth/`, `*storage-state*.json`;
- `LaptopsHub-private/`, `*.pem`, `*.p12`.

These sit alongside the existing `.env*`, `/backups/`, `*.dump` and `.isolated/` rules.

Smoke scripts:
- The scripts that create users or write data (`test-merchant-catalog-smoke`, `test-shopify-csv-commit-smoke`, `test-theme-publish-smoke`) already refuse non-local Supabase (`assertLocalOnly`).
- The three `tmp-*-smoke` scripts read production pages only. They add to a browser-side cart and never submit an order or sign in.

Production auth users were checked read-only on 2026-11-26: 2 accounts, **0** with test-like addresses. No smoke user leaked.

## 4. LH-025 private evidence

- The evidence lives only on the engineering workstation (`Documents\LaptopsHub-private\lh025-2026-11-26\` and `…\lh025-exec-2026-11-26\`). It was never committed.
- **Owner task:** copy both folders to client-controlled encrypted storage (for example an encrypted archive in the client's own cloud drive), then confirm. Engineering cannot do this, because it needs the client's account.
