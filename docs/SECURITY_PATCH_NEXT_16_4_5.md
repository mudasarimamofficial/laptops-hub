# Security patch: Next.js 16.4.2 → 16.4.5

Commit `42675d6` (`fix(deps)`), carried on branch `feat/merchant-operating-system`.

## What changed
| Package | Before | After | Lockfile |
|---|---|---|---|
| `next` | 16.4.2 | **16.4.5** | `package-lock.json` committed, `node_modules/next` = 16.4.5 |
| `eslint-config-next` | 16.4.2 | **16.4.5** | committed, = 16.4.5 |

No other dependency was intentionally changed. `npm run build` exits **0** (log: `docs/evidence/final-run/build.log`).

## The advisory
- **GHSA-mfr8-8qww-v76h** (moderate). Affects `next` versions from 16.3.0 through 16.4.4. The bug is a cache-key problem in `'use cache'` / `unstable_cache` when used together with root params. **16.4.5 fixes it.**
- Exposure before the patch was low:
  - the app does not use `'use cache'`;
  - it has no root params;
  - its one `unstable_cache` reader (published homepage sections) takes no request input and reads through a cookie-less public client.
- Why the build used to exit 1: Next.js 16.4 checks for advisories at build time, and when it detects an AI coding agent it ends an otherwise successful build with exit code 1. That check is the `experimental.agentUpgrade` default. Upgrading removed the advisory, so the build now exits 0.
- **No instructions from the build log were executed.** The upgrade was done the normal way: `package.json`, then `npm install`, then the lockfile.

## Audit (`npm audit`, 2026-11-17)
| Scope | Result |
|---|---|
| Production dependencies (`--omit=dev`) | **0 vulnerabilities** |
| All dependencies | **7 moderate, all dev-only, NOT resolved** |

The 7 remaining advisories all come from one source, **GHSA-g3hv-75wg-m249** in `minimatch`, pulled in transitively by `typescript-eslint` → `@typescript-eslint/{eslint-plugin, parser, type-utils, typescript-estree, utils}`.
- These packages are lint-time tooling only. They are not bundled into the app and not shipped to Vercel functions.
- `npm audit fix --force` would make semver-major changes to the lint toolchain, so it was not applied.
- Track this upstream. **These advisories are still open, not resolved.**

## Impact review of the upgrade
- **Caching:** the published-homepage reader still uses `unstable_cache` tagged `homepage-theme`, with a 60 s revalidate. Publish and rollback still expire that tag (`revalidateTag(..., { expire: 0 })`) and revalidate `/`. `/` still builds as static (○). The isolated publish → public-update → rollback test passes.
- **Auth:** behaviour is unchanged. All of these pass on 16.4.5:
  - `sec-auth-matrix` 24/24, `sec-role-matrix` 15/15, `sec-role-http` 126/126, `sec-direct-access` 193/193, `sec-p0-probe` 9/9;
  - the isolated E2E auth flows.
- **Preview isolation:** `/preview/homepage` still returns 404 for anonymous users and for fulfilment/manager staff. It still sends `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`, and `robots.txt` still disallows `/preview/`. Covered by the test `p1-theme-ordering-preview` › "preview is private".
- **Published theme rendering:** when the public flag is off (`THEME_PUBLISHED_ENABLED` unset, as in production), the HTML is identical to the built-in V5 default. Publishing the default layout gives the same HTML as the built-in default; this is covered by a test.
