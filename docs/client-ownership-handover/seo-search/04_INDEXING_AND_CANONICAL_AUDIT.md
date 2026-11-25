# 04 — Indexing and canonical

- **Preferred host:** `https://www.laptopshub.pk`. `http://laptopshub.pk` → `https://laptopshub.pk` → `https://www.laptopshub.pk` (two 308 hops, done by Vercel domain settings); `http://www` → `https://www` (308). Every canonical, sitemap URL and og:url uses `https://www.`.
- **Homepage canonical:** before, missing; now `https://www.laptopshub.pk` (Next.js writes the root without a trailing slash; Google treats it as the same URL as `/`).
- **Inner pages:** a self-canonical on collections, products, guides and pages.
- **Index coverage:** before, `site:laptopshub.pk` showed **2 results**. The verified count from Search Console is pending ownership verification (see 02/14). Google decides indexing; expect gradual growth after the sitemap is submitted.
- **Optional improvement (DNS/hosting owner decision):** make `http://laptopshub.pk` redirect straight to `https://www.` in one hop. This is minor, because Google follows two hops fine. Not changed: hosting and domain settings are out of scope without approval.
