import assert from "node:assert/strict";
import { sanitizeCmsHtml, LEGAL_CONTENT_SLUGS } from "../../src/lib/security/sanitize-html";

assert.ok(LEGAL_CONTENT_SLUGS.has("warranty"));
assert.ok(LEGAL_CONTENT_SLUGS.has("privacy"));

const scripty = sanitizeCmsHtml(`<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>`);
assert.equal(scripty.includes("script"), false);
assert.equal(scripty.includes("onerror"), false);
assert.equal(scripty.includes("<img"), false);
assert.match(scripty, /Hi/);

const jsUrl = sanitizeCmsHtml(`<a href="javascript:alert(1)">x</a>`);
assert.equal(/javascript:/i.test(jsUrl), false);

const dataUrl = sanitizeCmsHtml(`<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`);
assert.equal(/data:/i.test(dataUrl), false);

const okLink = sanitizeCmsHtml(`<a href="https://example.com" target="_blank">ok</a>`);
assert.match(okLink, /https:\/\/example\.com/);
assert.match(okLink, /noopener noreferrer/);
assert.equal(/javascript:/i.test(okLink), false);

const lists = sanitizeCmsHtml(`<h2>T</h2><ul><li>a</li></ul><p><strong>b</strong></p>`);
assert.match(lists, /<h2>/);
assert.match(lists, /<ul>/);
assert.match(lists, /<strong>/);

const iframe = sanitizeCmsHtml(`<iframe src="https://evil.test"></iframe><p>safe</p>`);
assert.equal(iframe.includes("iframe"), false);
assert.match(iframe, /safe/);

console.log("sanitize-html.test.ts ok");
