import assert from "node:assert/strict";
import { isCrossSiteAdminWrite } from "../../src/lib/security/admin-origin";

const URL_ = "https://www.laptopshub.pk/api/admin/notifications/settings";
const base = { pathname: "/api/admin/notifications/settings", url: URL_, host: "www.laptopshub.pk" };

// Cross-site writes to admin APIs are refused, whatever the method.
for (const method of ["POST", "PUT", "PATCH", "DELETE", "put"]) {
  assert.equal(isCrossSiteAdminWrite({ ...base, method, origin: "https://evil.example" }), true, method);
}
// A malformed Origin is treated as cross-site.
assert.equal(isCrossSiteAdminWrite({ ...base, method: "POST", origin: "not a url" }), true);
// Same site (as addressed by the proxy host) is allowed.
assert.equal(isCrossSiteAdminWrite({ ...base, method: "PUT", origin: "https://www.laptopshub.pk" }), false);
// The apex host is a different site from www unless the request was addressed to it.
assert.equal(isCrossSiteAdminWrite({ ...base, method: "PUT", origin: "https://laptopshub.pk" }), true);
// Local isolated server: url built from localhost, request addressed to 127.0.0.1.
assert.equal(
  isCrossSiteAdminWrite({ method: "POST", pathname: "/api/admin/posts", url: "http://localhost:3001/api/admin/posts", host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" }),
  false,
);
// No Origin (server-to-server, curl): left to the route's own staff check.
assert.equal(isCrossSiteAdminWrite({ ...base, method: "POST", origin: null }), false);
// Reads are never blocked here.
assert.equal(isCrossSiteAdminWrite({ ...base, method: "GET", origin: "https://evil.example" }), false);
assert.equal(isCrossSiteAdminWrite({ ...base, method: "HEAD", origin: "https://evil.example" }), false);
// Only /api/admin/*: public APIs keep their own rules (e.g. contact, checkout).
assert.equal(isCrossSiteAdminWrite({ ...base, pathname: "/api/contact", method: "POST", origin: "https://evil.example" }), false);
assert.equal(isCrossSiteAdminWrite({ ...base, pathname: "/api/administrator", method: "POST", origin: "https://evil.example" }), false);

console.log("admin-origin: ok");
