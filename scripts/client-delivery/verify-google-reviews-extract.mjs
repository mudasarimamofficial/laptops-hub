import { readFileSync } from "node:fs";

const html = readFileSync("laptops-hub-google-reviews.source.html", "utf8");
const json = JSON.parse(readFileSync("docs/client-delivery/google-reviews-reconciliation.json", "utf8"));

const m = html.match(/var REVIEWS = (\[[\s\S]*?\])\.map\(/);
if (!m) {
  console.error("FAIL: no REVIEWS array in HTML");
  process.exit(1);
}

const arr = JSON.parse(m[1]);
console.log("HTML REVIEWS", arr.length);
console.log("JSON candidates", json.candidates.length);

const normalize = (r) => ({
  authorName: r.a || r.authorName || r.name || r.author || "",
  rating: r.r ?? r.rating ?? r.stars ?? null,
  reviewDate: r.d || r.reviewDate || r.date || "",
  body: r.t || r.body || r.text || r.review || "",
  photoId: r.p || r.avatarPhotoId || "",
});

const htmlNorm = arr.map(normalize);
const key = (r) => `${r.authorName}|${String(r.body).slice(0, 80)}`;

const htmlKeys = htmlNorm.map(key);
const jsonKeys = json.candidates.map((r) => key(r));
const missing = htmlKeys.filter((k) => !jsonKeys.includes(k));
const extra = jsonKeys.filter((k) => !htmlKeys.includes(k));
console.log("missingInJson", missing.length, missing.slice(0, 3));
console.log("extraInJson", extra.length, extra.slice(0, 3));

let ratingMismatch = 0;
let dateMismatch = 0;
let bodyMismatch = 0;
for (const h of htmlNorm) {
  const j = json.candidates.find((c) => c.authorName === h.authorName && c.body.slice(0, 80) === h.body.slice(0, 80));
  if (!j) {
    bodyMismatch += 1;
    continue;
  }
  if (h.rating != null && j.rating !== h.rating) ratingMismatch += 1;
  if (h.reviewDate && j.reviewDate && h.reviewDate !== j.reviewDate) dateMismatch += 1;
  if (j.body !== h.body) bodyMismatch += 1;
}

const dupAuthors = Object.entries(
  htmlNorm.reduce((acc, r) => {
    acc[r.authorName] = (acc[r.authorName] || 0) + 1;
    return acc;
  }, {}),
).filter(([, n]) => n > 1);

console.log("unmatchedOrBodyDiff", bodyMismatch);
console.log("ratingMismatch", ratingMismatch);
console.log("dateMismatch", dateMismatch);
console.log("duplicateAuthors", dupAuthors.length, dupAuthors.slice(0, 5));

const ok =
  arr.length === 37 &&
  json.candidates.length === 37 &&
  missing.length === 0 &&
  extra.length === 0 &&
  bodyMismatch === 0 &&
  ratingMismatch === 0 &&
  dateMismatch === 0;
console.log(ok ? "PASS: extract matches HTML (37/37)" : "FAIL: extract discrepancy");
process.exit(ok ? 0 : 2);
