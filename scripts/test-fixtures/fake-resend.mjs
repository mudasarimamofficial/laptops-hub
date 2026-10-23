/**
 * Local stand-in for the Resend email API (POST /emails), for isolated tests only. Mirrors the behaviour the app
 * relies on: Bearer auth, Idempotency-Key de-duplication (same key + same body → same id, delivered once; same key
 * with a different body → 409 invalid_idempotent_request; a key still in flight → 409 concurrent_idempotent_requests,
 * as Resend documents), and switchable failure modes.
 *
 * Control: GET /_log, POST /_reset, POST /_mode {"fail": bool, "failTo": "addr"|null, "delayMs": n}
 *   fail     every send returns 500
 *   failTo   sends to this address return 500 (partial delivery)
 *   delayMs  the provider answers after n ms — and still accepts the message if the client gave up (timeout)
 *
 *   node scripts/test-fixtures/fake-resend.mjs [port=4599]
 */
import http from "http";

const port = Number(process.argv[2] || 4599);
let mode = { fail: false, failTo: null, delayMs: 0 };
const byKey = new Map(); // key → { id, body }
const inFlight = new Set();
const delivered = [];
let n = 0;

const send = (res, status, body) => {
  if (res.destroyed) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      if (req.method === "GET" && req.url === "/_log") return send(res, 200, { delivered, attempts: n });
      if (req.method === "POST" && req.url === "/_reset") {
        byKey.clear(); inFlight.clear(); delivered.length = 0; n = 0; mode = { fail: false, failTo: null, delayMs: 0 };
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && req.url === "/_mode") {
        const m = JSON.parse(raw || "{}");
        mode = { fail: !!m.fail, failTo: m.failTo || null, delayMs: Number(m.delayMs) || 0 };
        return send(res, 200, mode);
      }
      if (req.method === "POST" && req.url === "/emails") {
        n++;
        if (!/^Bearer .+/.test(req.headers.authorization || "")) return send(res, 401, { name: "missing_api_key", message: "Missing API key" });
        const body = JSON.parse(raw || "{}");
        if (mode.fail || (mode.failTo && (body.to || []).includes(mode.failTo))) {
          return send(res, 500, { name: "internal_server_error", message: "Simulated provider outage" });
        }
        const key = req.headers["idempotency-key"];
        const sig = JSON.stringify({ from: body.from, to: body.to, subject: body.subject, text: body.text });
        if (key && byKey.has(key)) {
          const prev = byKey.get(key);
          if (prev.body !== sig) return send(res, 409, { name: "invalid_idempotent_request", message: "Same key, different payload" });
          return send(res, 200, { id: prev.id });
        }
        if (key && inFlight.has(key)) return send(res, 409, { name: "concurrent_idempotent_requests", message: "Same key in progress" });
        if (key) inFlight.add(key);
        if (mode.delayMs) await new Promise((r) => setTimeout(r, mode.delayMs));
        const id = `fake_${delivered.length + 1}`;
        if (key) { byKey.set(key, { id, body: sig }); inFlight.delete(key); }
        delivered.push({ id, key: key || null, from: body.from, to: body.to, subject: body.subject, text: body.text });
        return send(res, 200, { id });
      }
      send(res, 404, { message: "not found" });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`fake-resend on http://127.0.0.1:${port}`));
