import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const app = join(process.cwd(), "src", "app");

{
  const ico = readFileSync(join(app, "favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0, "ICO reserved");
  assert.equal(ico.readUInt16LE(2), 1, "ICO type");
  assert.equal(ico.readUInt16LE(4), 3, "three icon sizes");
  const sizes = [0, 1, 2].map((i) => ico.readUInt8(6 + i * 16)).sort((a, b) => a - b);
  assert.deepEqual(sizes, [16, 32, 48], "ICO sizes 16/32/48");
}

for (const name of ["icon.png", "apple-icon.png"] as const) {
  const path = join(app, name);
  assert.equal(existsSync(path), true, `${name} exists`);
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} PNG signature`);
  assert.ok(buf.length > 1000, `${name} has payload`);
}

console.log("favicon-assets.test.ts: ok");
