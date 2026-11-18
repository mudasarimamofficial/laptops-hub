import assert from "node:assert/strict";
import { isRenderableReel, reelInputSchema, reelUrlProblem } from "../../src/lib/content/reels";
import { processReview, reviewSummary, type ReviewDeps, type ReviewRow } from "../../src/lib/validation/review";
import {
  articleVisibilityLabel,
  isArticlePubliclyVisible,
  postInputSchema,
  publishProblem,
  readMinutes,
} from "../../src/lib/content/blog";

// ── Reels ──
assert.equal(reelUrlProblem("https://cdn.example.com/v/a.mp4", "video"), null);
assert.equal(reelUrlProblem("http://127.0.0.1:54321/storage/v1/object/public/reels/a.webm", "video"), null);
assert.equal(reelUrlProblem("http://cdn.example.com/a.mp4", "video"), "scheme");
assert.equal(reelUrlProblem("javascript:alert(1)", "video"), "scheme");
assert.equal(reelUrlProblem("not a url", "video"), "invalid");
// External hosts (including previously blocked shops) are allowed when the path is a direct media file.
assert.equal(reelUrlProblem("https://ronin.pk/cdn/shop/videos/c/vp/x/x.HD-1080p-2.5Mbps-1.mp4", "video"), null);
assert.equal(reelUrlProblem("https://ronin.pk/cdn/shop/videos/c/vp/x/x.HD-1080p-2.5Mbps", "video"), null);
assert.equal(reelUrlProblem("https://cdn.RONIN.pk/a.mp4", "video"), null);
assert.equal(reelUrlProblem("https://notronin.pk.example.com/a.mp4", "video"), null);
assert.equal(reelUrlProblem("https://www.instagram.com/reel/abc/", "video"), "extension");
assert.equal(
  isRenderableReel({
    videoUrl: "https://ronin.pk/cdn/shop/videos/c/vp/x/x.HD-1080p-2.5Mbps-1.mp4?v=0",
    posterUrl: "https://ronin.pk/cdn/shop/files/preview_images/x.thumbnail.0000000000.jpg",
    hlsUrl: "https://ronin.pk/cdn/shop/videos/c/vp/x/x.m3u8?v=0",
  }),
  true,
);
assert.equal(reelUrlProblem("https://cdn.example.com/stream/a.m3u8", "hls"), null);
assert.equal(reelUrlProblem("https://10.0.0.5/a.mp4", "video"), "private_host");
assert.equal(reelUrlProblem("https://cdn.example.com/p.webp", "poster"), null);
assert.equal(reelUrlProblem("https://cdn.example.com/p.mp4", "poster"), "extension");

const reel = { title: "Unboxing", videoUrl: "https://cdn.example.com/a.mp4", rightsStatus: "owned", status: "published" };
assert.equal(reelInputSchema.safeParse(reel).success, true);
assert.equal(reelInputSchema.safeParse({ ...reel, rightsStatus: "pending" }).success, false, "publish needs rights");
assert.equal(reelInputSchema.safeParse({ ...reel, rightsStatus: "pending", status: "draft" }).success, true, "drafts may be pending");
assert.equal(reelInputSchema.safeParse({ ...reel, rightsStatus: "licensed" }).success, false, "licence needs a note");
assert.equal(reelInputSchema.safeParse({ ...reel, rightsStatus: "licensed", rightsNote: "Licensed from X, 2026" }).success, true);
assert.equal(reelInputSchema.safeParse({ ...reel, videoUrl: "https://www.ronin.pk/r.mp4" }).success, true, "external host allowed");
assert.equal(isRenderableReel({ videoUrl: "https://ronin.pk/a.mp4", posterUrl: null }), true);
assert.equal(isRenderableReel({ videoUrl: "https://cdn.example.com/a.mp4", posterUrl: "https://ronin.pk/p.jpg" }), true);
assert.equal(isRenderableReel({ videoUrl: "https://cdn.example.com/a.mp4", posterUrl: null }), true);
assert.equal(
  reelInputSchema.safeParse({ ...reel, mediaSource: "external_stream", status: "draft", rightsStatus: "pending" }).success,
  false,
  "stream source needs hls",
);
assert.equal(
  reelInputSchema.safeParse({
    ...reel,
    mediaSource: "external_stream",
    hlsUrl: "https://cdn.example.com/a.m3u8",
    status: "draft",
    rightsStatus: "pending",
  }).success,
  true,
);

// ── Reviews ──
assert.deepEqual(reviewSummary([]), { count: 0, average: null });
assert.deepEqual(reviewSummary([5, 4, 4]), { count: 3, average: 4.3 });
assert.deepEqual(reviewSummary([5, 9, 0, 3]), { count: 2, average: 4 });

function deps(opts: { limited?: boolean; product?: string | null; insertError?: string } = {}) {
  const rows: ReviewRow[] = [];
  const keys: string[] = [];
  const d: ReviewDeps = {
    rateLimit: async (k) => {
      keys.push(k);
      return opts.limited ? { ok: false, retryAfterSec: 3600 } : { ok: true };
    },
    productIdFor: async () => (opts.product === undefined ? "11111111-1111-4111-8111-111111111111" : opts.product),
    hashIp: (ip) => `h(${ip})`,
    insert: async (row) => {
      if (opts.insertError) return { error: opts.insertError };
      rows.push(row);
      return { error: null };
    },
  };
  return { d, rows, keys };
}
const URL_ = "https://laptops-hub.example/api/reviews";
const good = { handle: "dell-latitude-7490", name: "Ayesha", rating: 5, body: "Arrived as described, battery is fine." };
const run = (body: unknown, d: ReviewDeps, origin: string | null = "https://laptops-hub.example") =>
  processReview({ origin, url: URL_, ip: "1.2.3.4", body }, d);

(async () => {
  {
    const { d, rows, keys } = deps();
    const r = await run(good, d);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, status: "pending" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "pending", "never auto-approved");
    assert.equal(rows[0].reviewer_email, null);
    assert.equal(rows[0].ip_hash, "h(1.2.3.4)");
    assert.equal(keys[0], "review:h(1.2.3.4)", "rate limit key holds no raw IP");
  }
  {
    const { d, rows } = deps();
    assert.equal((await run({ ...good, rating: 6 }, d)).status, 400);
    assert.equal((await run({ ...good, rating: 4.5 }, d)).status, 400);
    assert.equal((await run({ ...good, body: "short" }, d)).status, 400);
    assert.equal((await run({ ...good, email: "nope" }, d)).status, 400);
    assert.equal((await run({ ...good, handle: "../x" }, d)).status, 400);
    assert.equal(rows.length, 0);
    const bad = await run({ ...good, body: "short" }, d);
    assert.ok((bad.body.fieldErrors as Record<string, string>).body);
  }
  {
    const { d, rows } = deps();
    const r = await run({ ...good, company: "bot" }, d);
    assert.equal(r.status, 200);
    assert.equal(rows.length, 0, "honeypot is dropped");
  }
  {
    const { d } = deps();
    assert.equal((await run(good, d, "https://evil.example")).status, 403);
  }
  {
    const { d } = deps({ limited: true });
    const r = await run(good, d);
    assert.equal(r.status, 429);
    assert.equal(r.headers?.["Retry-After"], "3600");
  }
  {
    const { d } = deps({ product: null });
    assert.equal((await run(good, d)).status, 404);
  }
  {
    const { d } = deps({ insertError: "boom" });
    const r = await run(good, d);
    assert.equal(r.status, 500);
    assert.doesNotMatch(JSON.stringify(r.body), /boom/, "no raw DB error");
  }

  // ── Blog ──
  assert.equal(postInputSchema.safeParse({ slug: "best-laptops-2026", title: "Best laptops", status: "draft" }).success, true);
  assert.equal(postInputSchema.safeParse({ slug: "Bad Slug", title: "Best laptops", status: "draft" }).success, false);
  assert.equal(postInputSchema.safeParse({ slug: "-x-", title: "Best laptops", status: "draft" }).success, false);
  assert.equal(readMinutes("<p>" + "word ".repeat(450) + "</p>"), 2);
  assert.equal(readMinutes(""), 1);
  assert.equal(publishProblem({ status: "published", bodyHtml: "<p> </p>" }), "Write the post before publishing it.");
  assert.equal(publishProblem({ status: "published", bodyHtml: "" }), "Write the post before publishing it.", "no implicit template publishing");
  assert.equal(publishProblem({ status: "published", bodyHtml: "<p>Real text</p>" }), null);
  assert.equal(publishProblem({ status: "draft", bodyHtml: "" }), null);
  assert.equal(articleVisibilityLabel({ status: "draft" }), "Draft");
  assert.equal(articleVisibilityLabel({ status: "published" }), "Published");
  assert.equal(
    articleVisibilityLabel({ status: "published", scheduled_for: new Date(Date.now() + 86_400_000).toISOString() }),
    "Scheduled",
  );
  assert.equal(isArticlePubliclyVisible({ status: "draft" }), false);
  assert.equal(isArticlePubliclyVisible({ status: "published" }), true);
  assert.equal(
    isArticlePubliclyVisible({ status: "published", scheduled_for: new Date(Date.now() + 86_400_000).toISOString() }),
    false,
  );
  assert.equal(
    isArticlePubliclyVisible({ status: "published", scheduled_for: new Date(Date.now() - 86_400_000).toISOString() }),
    true,
  );
  assert.equal(
    postInputSchema.safeParse({
      slug: "scheduled-guide",
      title: "Scheduled guide",
      status: "published",
      bodyHtml: "<p>Ready</p>",
      tags: ["ram", "buying"],
      scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
    }).success,
    true,
  );
  assert.equal(
    postInputSchema.safeParse({
      slug: "bad-cover",
      title: "Bad cover",
      status: "draft",
      coverImageUrl: "http://insecure.example/a.jpg",
    }).success,
    false,
  );
  console.log("reels-reviews-blog: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
