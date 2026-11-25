# 02 — Google Search Console

**Status (2026-11-25): no property exists yet. Waiting for the owner to sign in.**

- Google's own `site:` page showed "Do you own laptopshub.pk? Try Google Search Console". No verified property, and so no sitemap submission, existed.
- Decision (owner, 2026-11-25): the property will be created under the **business's own Google account** ("client signs in first"), so ownership is not lost when developer access is removed at handover.

**Planned steps, once the business account is signed in to Chrome**
1. Search Console → Add property → **Domain** → `laptopshub.pk`. This covers www, the apex and every protocol.
2. Copy the `google-site-verification=…` TXT value.
3. Vercel → Domains → `laptopshub.pk` DNS → **add one TXT record** at the apex (`@`). Nothing else is changed: all existing records stay, including the CRM `app` A record.
4. Verify in Search Console. DNS can take minutes to hours.
5. Submit `https://www.laptopshub.pk/sitemap.xml`.
6. URL Inspection → Request indexing for: the homepage, `/collections/all`, `/collections/laptops`, `/guides` and the contact page.
7. Optionally add a developer as a **restricted/full user** (never as the only owner).

Indexed/excluded counts are recorded in 14 once Google reports them (often 1–3 days after verification).
