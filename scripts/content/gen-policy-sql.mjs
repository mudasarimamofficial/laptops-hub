import fs from "fs";
import path from "path";

const legal = ["shipping", "returns", "warranty", "privacy", "terms"];
const dir = "content/drafts";
const parts = [];
for (const slug of legal) {
  const body = fs.readFileSync(path.join(dir, `${slug}.html`), "utf8").trim();
  const tag = `b_${slug}`;
  parts.push(
    `update public.content_pages set body_html = $${tag}$${body}$${tag}$, status = 'published', legal_approved = true, legal_approved_at = now(), updated_at = now() where slug = '${slug}';`,
  );
  console.log(slug, body.length);
}
parts.push(
  `select slug, status, legal_approved, length(body_html) as body_len from content_pages where slug in ('shipping','returns','warranty','privacy','terms') order by slug;`,
);
fs.writeFileSync("scripts/content/_publish_policies.sql", parts.join("\n"));
console.log("wrote scripts/content/_publish_policies.sql");
