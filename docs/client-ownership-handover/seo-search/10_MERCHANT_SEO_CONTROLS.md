# 10 — Merchant SEO controls (Admin)

| Control | Where | Who can change it | Effect | Safety |
|---|---|---|---|---|
| Homepage search title + description | Admin → SEO → *Homepage search appearance* | Owner, admin, manager (editors see it read-only) | The homepage `<title>`, meta description, og:title and og:description. Empty fields use the default (brand + city). | Plain text only, length-capped (120/320), control characters stripped, HTML-escaped on output. Live within about a minute. "Reset to default" restores the default. |
| Title suffix | Admin → SEO / Settings | Owner, admin, manager | Text after inner page titles (e.g. "· Laptops HUB"). | Plain text. Saving now expires the cached storefront head. |
| Product SEO title/description | Admin → Products → product → SEO | Staff with product edit rights | Overrides the generated title (brand · CPU · RAM · storage) and description. | Empty uses the generated text, built from verified specs only. |
| Collection SEO title/description | Admin → Collections → collection | Staff with collection rights | Collection title/description and social card. | Empty uses the collection's own description, else "<name> at Laptops HUB, Bahawalpur…". |
| Guide SEO title/description/image/author/dates | Admin → Blog → article | Content staff | Guide title, description, Article markup, social card. | Only fields the merchant set are published. No invented authors, ratings or FAQs. |
| Business identity (name, address, phones, email, socials) | Admin → Settings → Contact & Social | Owner, admin, manager | Business JSON-LD on every page, the footer and the contact page. | Disabled phones and socials, and non-https links, are not published. |
| Duplicate-title report | Admin → SEO → *Products sharing one search title* | Everyone with SEO page access (read-only list) | Shows products Google would treat as copies. | Changes nothing automatically. |
| Missing-metadata checklist | Admin → SEO | Read-only | Lists products and collections without SEO fields. | Informational only. Generated defaults already exist. |
| Search Console steps | Admin → SEO → *Google Search Console* | Read-only | Sitemap URL and the steps to follow. | No guarantees are claimed. |

**Not editable by design:** global `noindex`, robots.txt rules and canonical host. A single mistaken toggle could remove the whole site from Google, so these change only through code review.
