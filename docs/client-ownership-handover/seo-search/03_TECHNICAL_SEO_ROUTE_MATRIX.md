# 03 — Technical SEO route matrix

| Route family | Indexable | In sitemap | Canonical | Notes |
|---|---|---|---|---|
| `/` | yes | yes | root | brand + city title (admin-editable) |
| `/collections/*` | yes (published) | yes (39) | self | own description or brand+city fallback |
| `/products/*` | yes (active) | yes (226) | self | generated or merchant SEO title; Product + Breadcrumb markup |
| `/guides`, `/guides/*` | yes (published) | yes (5) | self | Article + Breadcrumb markup |
| `/pages/*` | yes (published) | yes (8) | self | |
| `/compare` | **noindex, follow** | no | self | thin, user-specific |
| `/search` | noindex, follow | no | — | also robots-blocked |
| `/checkout` | noindex, nofollow | no | — | also robots-blocked |
| `/cart`, `/order/*`, `/track-order` | robots-blocked | no | — | private |
| `/admin/*`, `/api/*`, `/preview/*` | robots-blocked; admin pages noindex | no | — | |
| unknown | 404 + noindex | no | — | |

Live evidence: 13_PRODUCTION_DEPLOYMENT_EVIDENCE.md.
