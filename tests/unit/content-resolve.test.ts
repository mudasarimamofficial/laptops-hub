import assert from "node:assert/strict";
import { isContentPublic, resolveContent, templateHasPending } from "../../src/lib/content/resolve";
import type { V5Page } from "../../src/lib/content/types";

const tpl: V5Page = {
  title: "Shipping & delivery",
  kicker: "Policy",
  status: "pending",
  intro: "Delivery coverage, timelines and costs.",
  blocks: [
    { t: "pending", v: "Delivery policy" },
    { t: "h2", v: "Shipping at checkout" },
    { t: "p", v: "Unapproved template copy." },
  ],
};
const contactTpl: V5Page = { title: "Contact us", kicker: "Support", status: "pending", intro: "Ask us.", blocks: [{ t: "form" }, { t: "h2", v: "Other ways" }, { t: "pending", v: "Contact details" }] };
const row = (o: Partial<{ status: string; legal_approved: boolean; body_html: string }>) => ({ slug: "x", title: "CMS title", body_html: "", status: "published", legal_approved: false, ...o });

delete process.env.V5_CONTENT_PREVIEW;

// Unpublished → gated: only pending placeholders, no template copy.
{
  const r = resolveContent("shipping", tpl, undefined, true);
  assert.equal(r.mode, "gated");
  assert.deepEqual(r.blocks.map((b) => b.t), ["pending"]);
  assert.equal(r.html, null);
}
// Legal page published WITHOUT legal approval stays gated even if a row leaks through.
{
  const r = resolveContent("shipping", tpl, row({ legal_approved: false, body_html: "<p>Delivery in 2 days</p>" }), true);
  assert.equal(r.mode, "gated");
  assert.equal(r.html, null);
}
// Draft/pending rows are never visible.
assert.equal(resolveContent("about", tpl, row({ status: "draft", body_html: "<p>x</p>" }), false).mode, "gated");
assert.equal(resolveContent("about", tpl, row({ status: "pending", body_html: "<p>x</p>" }), false).mode, "gated");
// Legal page published WITH approval and a body → sanitized CMS HTML.
{
  const r = resolveContent("shipping", tpl, row({ legal_approved: true, body_html: '<h2>Zones</h2><p onclick="x()">Hi<script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src=x onerror=alert(1)></p>' }), true);
  assert.equal(r.mode, "cms");
  assert.equal(r.title, "CMS title");
  assert.ok(r.html && r.html.includes("<h2>Zones</h2>"));
  assert.ok(!/script|onclick|onerror|javascript:|<img/i.test(r.html!), r.html!);
}
// Published with an empty body on a template that still has pending sections → stays gated: an empty body never
// publishes unresolved owner facts or the template copy around them (also for approved legal pages).
{
  const r = resolveContent("about", tpl, row({ body_html: "   " }), false);
  assert.equal(r.mode, "gated");
  assert.ok(!r.blocks.some((b) => b.t === "p"), "no template copy");
  assert.equal(isContentPublic(tpl, row({ body_html: "" }), false), false);
  assert.equal(resolveContent("shipping", tpl, row({ body_html: "", legal_approved: true }), true).mode, "gated");
}
// Published with an empty body on a template with no pending sections → V5 template (approval enforced at publish).
{
  const guideTpl: V5Page = { ...tpl, blocks: [{ t: "h2", v: "Processor generations" }, { t: "p", v: "Factual copy." }] };
  const r = resolveContent("how-to-choose", guideTpl, row({ body_html: "" }), false);
  assert.equal(r.mode, "template");
  assert.equal(r.blocks.length, 2);
  assert.equal(r.preview, false);
  assert.equal(isContentPublic(guideTpl, row({ body_html: "" }), false), true);
  assert.equal(isContentPublic(guideTpl, row({ status: "draft" }), false), false);
}
// Own CMS body is public even when the template has pending sections.
assert.equal(isContentPublic(tpl, row({ body_html: "<p>Approved copy</p>" }), false), true);
assert.equal(templateHasPending(tpl), true);
// Contact page gated: the form stays, plus its own pending section only.
{
  const r = resolveContent("contact", contactTpl, undefined, false);
  assert.deepEqual(r.blocks.map((b) => b.t), ["form", "pending"]);
}
// Preview flag renders templates for QA, but never on Vercel Production.
{
  process.env.V5_CONTENT_PREVIEW = "1";
  process.env.VERCEL_ENV = "preview";
  const r = resolveContent("shipping", tpl, undefined, true);
  assert.equal(r.mode, "template");
  assert.equal(r.preview, true);
  process.env.VERCEL_ENV = "production";
  assert.equal(resolveContent("shipping", tpl, undefined, true).mode, "gated");
  delete process.env.V5_CONTENT_PREVIEW;
  delete process.env.VERCEL_ENV;
}
console.log("content-resolve.test.ts ok");
