import fs from "fs";

const json = JSON.parse(fs.readFileSync("docs/client-delivery/google-reviews-reconciliation.json", "utf8"));
const maps = "https://maps.google.com/?cid=7987323353592411341";
const note =
  "Verified against laptops-hub-google-reviews.source.html (owned GBP review export). Published with Google place attribution; avatars omitted pending photo permission.";

const values = json.candidates.map((c, i) => {
  const author = c.authorName.replace(/'/g, "''");
  const body = c.body.replace(/'/g, "''");
  const vnote = note.replace(/'/g, "''");
  const date = c.reviewDate ? `'${c.reviewDate}'` : "null";
  const rating = c.rating == null ? "null" : String(c.rating);
  return `(gen_random_uuid(), '${author}', ${rating}, '${body}', ${date}, 'google', '${maps}', null, false, true, '${vnote}', 'published', true, false, ${i + 1}, now(), now())`;
});

const sql = `
-- Idempotent-ish: skip if same author+body already exists
with incoming(author_name, rating, body, review_date, source, source_url, avatar_url, avatar_permission, consent_confirmed, verification_note, status, show_on_homepage, featured, sort_order) as (
  values
${json.candidates
  .map((c, i) => {
    const author = c.authorName.replace(/'/g, "''");
    const body = c.body.replace(/'/g, "''");
    const vnote = note.replace(/'/g, "''");
    const date = c.reviewDate ? `'${c.reviewDate}'::date` : "null::date";
    const rating = c.rating == null ? "null::int" : `${c.rating}::int`;
    return `    ('${author}', ${rating}, '${body}', ${date}, 'google', '${maps}', null, false, true, '${vnote}', 'published', true, false, ${i + 1})`;
  })
  .join(",\n")}
)
insert into public.store_testimonials (
  author_name, rating, body, review_date, source, source_url, avatar_url, avatar_permission,
  consent_confirmed, verification_note, status, show_on_homepage, featured, sort_order, published_at, updated_at
)
select
  i.author_name, i.rating, i.body, i.review_date, i.source, i.source_url, i.avatar_url, i.avatar_permission,
  i.consent_confirmed, i.verification_note, i.status, i.show_on_homepage, i.featured, i.sort_order, now(), now()
from incoming i
where not exists (
  select 1 from public.store_testimonials t
  where t.author_name = i.author_name and t.body = i.body
);

update public.shipping_zones
set notes = 'Launch tariffs: delivery Rs 360, COD fee Rs 50. Editable in Admin → Settings. Free delivery available later via explicit Rs 0 fee or free-from threshold.',
    updated_at = now()
where name = 'All Over PK';

select count(*) as testimonials, count(*) filter (where status='published') as published
from store_testimonials;
`;

fs.writeFileSync("scripts/content/_publish_reviews.sql", sql);
console.log("candidates", json.candidates.length, "sql bytes", sql.length);
