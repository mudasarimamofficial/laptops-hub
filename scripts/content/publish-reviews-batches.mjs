import fs from "fs";

const json = JSON.parse(fs.readFileSync("docs/client-delivery/google-reviews-reconciliation.json", "utf8"));
const maps = "https://maps.google.com/?cid=7987323353592411341";
const note =
  "Verified against laptops-hub-google-reviews.source.html (owned GBP review export). Published with Google place attribution; avatars omitted pending photo permission.";

function esc(s) {
  return String(s).replace(/\r\n|\r|\n/g, "\\n").replace(/'/g, "''");
}

const batches = [];
for (let i = 0; i < json.candidates.length; i += 10) {
  const slice = json.candidates.slice(i, i + 10);
  const values = slice
    .map((c, idx) => {
      const sort = i + idx + 1;
      const date = c.reviewDate ? `'${c.reviewDate}'::date` : "null::date";
      const rating = c.rating == null ? "null::int" : `${c.rating}::int`;
      return `('${esc(c.authorName)}', ${rating}, '${esc(c.body)}', ${date}, 'google', '${maps}', null, false, true, '${esc(note)}', 'published', true, false, ${sort})`;
    })
    .join(",\n");
  const sql = `with incoming(author_name, rating, body, review_date, source, source_url, avatar_url, avatar_permission, consent_confirmed, verification_note, status, show_on_homepage, featured, sort_order) as (
  values
${values}
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
select count(*) as total, count(*) filter (where status='published') as published from store_testimonials;`;
  batches.push(sql);
  fs.writeFileSync(`scripts/content/_reviews_batch_${batches.length}.sql`, sql);
}
console.log("batches", batches.length);
fs.writeFileSync("scripts/content/_reviews_batches.json", JSON.stringify(batches));
