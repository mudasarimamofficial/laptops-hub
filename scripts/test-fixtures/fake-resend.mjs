/**
 * Local stand-in for the Resend email API (POST /emails), for isolated tests only. Mirrors the behaviour the app
 * relies on: Bearer auth, Idempotency-Key de-duplication (same key → same id, delivered once), and switchable
 * failure mode. Control: GET /_log, POST /_reset, POST /_mode {"fail": true|false}.
 *
 *   node scripts/test-fixtures/fake-resend.mjs [port=4599]
 */
import http from "http";

const port = Number(process.argv[2] || 4599);
let fail = false;
const byKey = new Map();
const delivered = [];
let n = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "GET" && req.url === "/_log") return send(res, 200, { delivered, attempts: n });
      if (req.method === "POST" && req.url === "/_reset") { byKey.clear(); delivered.length = 0; n = 0; fail = false; return send(res, 200, { ok: true }); }
      if (req.method === "POST" && req.url === "/_mode") { fail = !!JSON.parse(raw || "{}").fail; return send(res, 200, { fail }); }
      if (req.method === "POST" && req.url === "/emails") {
        n++;
        if (!/^Bearer .+/.test(req.headers.authorization || "")) return send(res, 401, { name: "missing_api_key", message: "Missing API key" });
        if (fail) return send(res, 500, { name: "internal_server_error", message: "Simulated provider outage" });
        const key = req.headers["idempotency-key"];
        if (key && byKey.has(key)) return send(res, 200, { id: byKey.get(key) });
        const body = JSON.parse(raw || "{}");
        const id = `fake_${delivered.length + 1}`;
        if (key) byKey.set(key, id);
        delivered.push({ id, key: key || null, from: body.from, to: body.to, subject: body.subject, text: body.text });
        return send(res, 200, { id });
      }
      send(res, 404, { message: "not found" });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`fake-resend on http://127.0.0.1:${port}`));
