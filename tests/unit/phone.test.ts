import assert from "node:assert/strict";
import { normalizePakistanMobile } from "../../src/lib/phone";

const a = normalizePakistanMobile("03001234567");
assert.equal(a.ok, true);
if (a.ok) {
  assert.equal(a.e164, "+923001234567");
  assert.equal(a.normalized, "923001234567");
}

const b = normalizePakistanMobile("+923001234567");
assert.equal(b.ok, true);

const c = normalizePakistanMobile("123");
assert.equal(c.ok, false);
console.log("phone.test.ts ok");
