# 00 — Search visibility: executive summary (2026-11-25)

**Complaint:** searching "Laptops HUB" (and the Pakistan, Bahawalpur and domain variants) did not reliably show the official website.

**Root cause (evidence in 01):** Google barely knew the site. Only about 2 pages were indexed, no Search Console or sitemap submission had ever happened, and Google was still showing stale data from an older site (the "Janvi Foods" name, an old favicon). The homepage also sent weak brand signals. Crawlability was fine.

**Fixed and live (PR #80, production Ready):**
- Homepage title "Laptops HUB — Laptop Shop in Bahawalpur, Pakistan", with a factual description, canonical and social cards.
- Full business markup (address, phones, email, social profiles, logo) and site-name signals from Contact & Social only.
- Guides get Article markup; every page now has a social card with the site name.
- `/compare` removed from the index and sitemap. Readable homepage heading.
- Admin → SEO: edit the homepage search text, see the business identity, see products that share a title (9 groups / 19 products found), and Search Console steps.

**Still needed (owner):**
1. Sign in to Chrome with the business Google account so Search Console can be set up and the sitemap submitted (02, 14).
2. Confirm the Business Profile links to the website and that the address wording matches (08).
3. Resolve the duplicate product titles (06).

**Expectations:** Google re-crawls on its own schedule. Improvements typically show over days to weeks after the sitemap is submitted. Rankings cannot be guaranteed. Other shops use similar names, so consistent business details and real content matter more than any tag.

Status: **READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED** (unchanged for commerce). SEO engineering under our control: done and deployed. Google-side steps: waiting on the owner.
