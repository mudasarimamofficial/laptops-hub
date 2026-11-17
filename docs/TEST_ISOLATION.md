# Test isolation and contamination guard

These rules cover the isolated stack only: local Supabase, the app on `127.0.0.1:3001`, and `fake-resend`. Every spec calls `assertLocalOnly()`. **No production data is read or cleaned by these tests.**

## What went wrong
A 4-hour machine sleep in the middle of the run interrupted `z-owner-acceptance-36-steps`. Its afterAll never ran, so it left synthetic data behind in the **local** database:
- an active `qa-acceptance-laptop-*` product with 2 orders;
- `social_proof` still switched on;
- a reel, a review and a guide.

The next run then treated that leftover state as its baseline.

## Guard (`tests/e2e-isolated/helpers/run-guard.ts`)
- Before changing any shared state, a spec writes its baseline to `.isolated/run-guard/<name>.json`, which is git-ignored.
- The file is deleted only **after** teardown has restored that baseline.
- If the file already exists when a spec starts, a previous run died. The new run restores the recorded baseline first and keeps it as its baseline, instead of trusting the current state.
- Restores go through the real admin API with an owner bearer token, or through the local service client. A dead browser or an expired page session therefore cannot block them.

| Spec | Guard name | Baseline | Extra cleanup |
|---|---|---|---|
| `z-owner-acceptance-36-steps` | `owner-acceptance-36` | `social_proof` setting and homepage publication | Sweeps the deterministic synthetic prefixes (`qa-acceptance-laptop-%`, `QA acceptance reel %`, `QA Acceptance Reviewer %`, `qa-acceptance-guide-%`, `qa-acceptance-%` collections) before and after the run. Asserts that 0 active QA products remain before starting. |
| `p1-theme-ordering-preview` | `theme-ordering-preview` | Working draft sections and homepage publication | Asserts that no synthetic map heading is in the baseline draft. |

## Proof (2026-11-17, local stack)
1. Both hardened specs run together passed **14/14** in 3.8 min. No guard file was left behind.
2. **Crash simulation:**
   - Baseline before the run: publication `f2d008ea…`, draft md5 `25b6fc35…`.
   - `p1-theme-ordering-preview` was killed with SIGKILL in the middle of test 3 (reorder / hide / edit / save).
   - Result: the draft was left modified (md5 `ebfe10c8…`) and the guard file survived.
3. **Rerun:** the stored baseline was restored first, then **5/5 passed**.
   - Final state: publication `f2d008ea…`, draft md5 `25b6fc35…`, identical to the baseline.
   - The guard file was removed.
