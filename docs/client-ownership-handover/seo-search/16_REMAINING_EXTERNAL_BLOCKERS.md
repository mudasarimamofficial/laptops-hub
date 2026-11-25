# 16 — Remaining external blockers and owner actions

| # | Item | Why it is blocked | Exact action |
|---|---|---|---|
| E1 | Search Console Domain property for `laptopshub.pk` | It must be owned by the **business's own Google account**, not a developer account that will be removed at handover. | The owner signs in to Chrome with the business Google account. Engineering then creates the Domain property, adds **one TXT record** in Vercel DNS (all other records preserved, including the CRM `app` record), verifies it, submits the sitemap and inspects key URLs. |
| E2 | Google re-crawl / re-index | Only Google decides when to crawl, index, show a site name or update a favicon. | After E1: submit the sitemap and request indexing for the homepage, top collections and guides. Expect days to weeks. Never promise a ranking. |
| E3 | Google Business Profile → website link | The profile is managed outside this project. | The profile owner opens business.google.com, checks that the Website field is `https://www.laptopshub.pk`, and that the name, phone and address match the site. Do not create a second profile. |
| E4 | Address wording ("Shop no 3") | The Business Profile and Facebook say "Shop no 3, 1st Floor…"; the site says "1st Floor…". This is a business fact. | The owner decides the exact official address, then updates Admin → Settings → Contact & Social (and the profile) to match **exactly**. |
| E5 | Store hours, map pin, ratings | Not supplied. Inventing them is prohibited. | If the owner supplies hours, they can be added to Contact & Social and the markup in a follow-up. Ratings come only from Google reviews, never from site markup. |
| E6 | Duplicate product titles (9 groups, 19 products) | Catalog decision: are they true duplicates or different units? | Admin → SEO → "Products sharing one search title": give each a distinct true SEO title, or archive real duplicates. |
| E7 | Merchant Center / free product listings | Needs a Merchant Center account under the business, plus policy pages (returns, shipping) the owner must write. | The owner decides. Do not publish invented return or shipping policies. |
| E8 | Paid ads | Not authorised. | None unless the owner explicitly approves a budget. |
