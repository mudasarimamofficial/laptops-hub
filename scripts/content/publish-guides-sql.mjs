import fs from "fs";
import { createRequire } from "module";

// Use compiled-ish import via dynamic - run with tsx instead if needed.
// Fallback: shell out to generate HTML via node+tsx one-liner file.

const { guideDraftSeeds } = await import("../../src/lib/content/blog-guide-drafts.ts");

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const seeds = guideDraftSeeds();
const values = seeds
  .map((s) => `('${esc(s.slug)}', '${esc(s.title)}', '${esc(s.excerpt)}', '${esc(s.bodyHtml)}', 'published', now(), now())`)
  .join(",\n");

const sql = `
with incoming(slug, title, excerpt, body_html, status, published_at, updated_at) as (
  values
${values}
)
insert into public.articles (slug, title, excerpt, body_html, status, published_at, updated_at)
select i.slug, i.title, i.excerpt, i.body_html, i.status, i.published_at, i.updated_at
from incoming i
where not exists (select 1 from public.articles a where a.slug = i.slug);

update public.articles a
set title = i.title,
    excerpt = i.excerpt,
    body_html = i.body_html,
    status = 'published',
    published_at = coalesce(a.published_at, now()),
    updated_at = now()
from incoming i
where a.slug = i.slug;

select slug, status, length(body_html) as body_len from articles order by slug;
`;

fs.writeFileSync("scripts/content/_publish_guides.sql", sql);
console.log("guides", seeds.length, "bytes", sql.length);
