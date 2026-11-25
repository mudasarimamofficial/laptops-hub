# 11 — Admin edits vs SEO safety

| Risk | Guard | Evidence |
|---|---|---|
| Merchant text becomes markup (stored XSS) | SEO text is cleaned to plain text, length-capped and escaped by React/Next metadata. JSON-LD escapes `<` as `<`. | e2e: saves `<script>alert(1)</script>` in the homepage title and asserts the raw tag never appears in the public HTML; unit: the `</script>` escape |
| Unsafe links in markup | `sameAs` only includes enabled `https://` URLs; `javascript:` links are dropped | unit test |
| Editor disables indexing by accident | No sitewide noindex or robots control exists in the admin. Homepage SEO is limited to owner/admin/manager; editors are read-only, and the API returns 403 | e2e: editor UI disabled, API 403 |
| Saved SEO not reaching the live site | Saving SEO settings expires the `settings` cache tag and the storefront layout | e2e: a public homepage title change is observed after save, and the reset restores the default |
| Theme publish wiping metadata | The theme stores layout and presentation only. Titles, descriptions, canonical and JSON-LD come from settings and catalog, not theme data | Code path review; theme-globals e2e still passes (part of the 30/31 neighbouring run) |
| Draft/private pages indexed | Preview routes, checkout, search and cart are noindex and/or robots-blocked; drafts are not in the sitemap | robots.txt + e2e sitemap checks |
| Silent overwrite of merchant SEO | Generated defaults apply only when a field is empty; stored merchant text always wins | unit: `parseSeoDefaults`/`homeSearchAppearance` |
