# Resume here

State: **Phase 1 correctness fixes on `fix/v5-correctness-parity`** (branched from `feat/v5-storefront-admin` @ `ea652f2`), 2026-10-21. Fill in the commit SHA and Preview URL once pushed.

## Verified infrastructure
- GitHub: `mudasarimamofficial/laptops-hub` · working branch `fix/v5-correctness-parity`
- Vercel: `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` (`laptops-hub`, team `mudasarimamofficial-gmailcoms-projects`)
- Supabase: `xvmmjkrkgznnakcobmww` · documented baseline 232 / 226 public / 6 drafts (re-verify live)
- COD: **off** · no Production promote

## This phase
- Related-product media, availability guard + inquiry dialog, V5 compare tray, curated specs, public-field boundary, cart `max_per_order`, importer syntax fix.
- Checklist: `docs/NEXTJS_PARITY_AUDIT.md` (statuses per finding).

## Next safe engineering action
1. Run all checks in APPLY.md; fix real failures; push; verify the Preview's branch and SHA.
2. Owner decisions: `docs/proposals/AVAILABILITY_INQUIRY_ONLY.md`, `docs/proposals/DESCRIPTION_CLEANUP.md`, media approval.
3. Phase 2 (after acceptance): collection filters/sort, homepage V5 section order, new-generation carousel, PDP chrome, unapproved copy, full visual regression.

Do **not** promote Production, enable COD, run the importer against production, or apply proposal SQL without approval.
