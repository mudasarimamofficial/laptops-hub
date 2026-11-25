# 14 — Search Console submission evidence (2026-11-25)

| Step | Status | Evidence |
|---|---|---|
| Business Google account signed in | **DONE** | Chrome profile signed in as the business account "Laptops Hub" (the store's own email). |
| Domain property `laptopshub.pk` | **DONE** | Domain property (covers www, apex, http and https). |
| DNS verification | **DONE: one record added** | Vercel DNS (authoritative: ns1/ns2.vercel-dns.com). A before/after `vercel dns ls` diff shows exactly **one added line**: an apex `TXT google-site-verification=…` record. All other records are unchanged (the Resend/SES `send` records, the CRM `app`/`www.app` A records → same IP, CAA, ALIAS). `app.laptopshub.pk` still resolves to the same address afterwards. |
| Ownership verified | **DONE** | "Ownership verified — Domain name provider". Users and permissions: **1 user, the business account, Owner (verified)**. No developer account is an owner. Unused ownership tokens: 0. |
| Sitemap | **DONE** | `https://www.laptopshub.pk/sitemap.xml`: status **Success**, last read 25 Nov 2026, **279 discovered pages**. |
| Homepage URL Inspection | **DONE** | Google index: "URL is not on Google — **Blocked due to access forbidden (403)**". Last crawl **22 Oct 2026**, Googlebot smartphone. **Live test today: "URL is available to Google — Page can be indexed."** Indexing requested (priority crawl queue). |
| `/collections/laptops` | DONE | Already "URL is on Google" (this is the result Google labelled "Janvi Foods"). Re-indexing requested so the new site name and social card are picked up. |
| `/collections/all` | DONE | "URL is unknown to Google". Indexing requested. |
| `/guides` | DONE | "Discovered – currently not indexed" (found via the sitemap within minutes). Indexing requested. |
| `/pages/contact` | DONE | "URL is not on Google". Indexing requested. |
| Indexed / not-indexed totals | **AWAITING GOOGLE** | The Pages report fills in over the next days. Re-check *Indexing → Pages*. |

**Keep the TXT record.** Removing it un-verifies the property.

No Google account cookies, tokens or screenshots containing account data are stored in this repository.
