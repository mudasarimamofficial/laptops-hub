import assert from "node:assert/strict";
import { formatPkr, pkrMajorToPaisa, paisaToMajor } from "../../src/lib/money";

assert.equal(pkrMajorToPaisa(16000), 1_600_000);
assert.equal(pkrMajorToPaisa("16000.00"), 1_600_000);
assert.equal(paisaToMajor(1_600_000), 16000);
assert.match(formatPkr(1_600_000), /16,000|16000/);
console.log("money.test.ts ok");
