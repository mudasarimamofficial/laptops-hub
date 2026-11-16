/**
 * TCP proxy that adds network latency between the app and the LOCAL Supabase API, to model where the app's server
 * functions run relative to the database. Each chunk is delayed by ONE_WAY_MS in each direction (order preserved),
 * so every request/response round trip costs about 2 × ONE_WAY_MS. TCP/TLS handshakes are not modelled, so results
 * understate real cross-region cost.
 *
 * Usage: node scripts/perf/latency-proxy.mjs <listenPort> <targetPort> <oneWayMs>
 *   e.g. 110 ms one way ≈ Vercel iad1 (US East) ↔ Supabase ap-southeast-1 (Singapore);  1 ms ≈ same region.
 * Local only: it forwards to 127.0.0.1 and nothing else.
 */
import net from "node:net";

const [listen = "54399", target = "54321", oneWay = "110"] = process.argv.slice(2);
let delay = Number(oneWay);

function delayed(src, dst) {
  let last = 0;
  src.on("data", (chunk) => {
    const at = Math.max(Date.now() + delay, last);
    last = at;
    setTimeout(() => dst.writable && dst.write(chunk), at - Date.now());
  });
  src.on("end", () => setTimeout(() => dst.end(), Math.max(0, last - Date.now()) + delay));
  src.on("error", () => dst.destroy());
}

net
  .createServer((client) => {
    const upstream = net.connect(Number(target), "127.0.0.1");
    delayed(client, upstream);
    delayed(upstream, client);
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
  })
  .listen(Number(listen), "127.0.0.1", () => console.log(`latency-proxy 127.0.0.1:${listen} -> :${target} one-way ${delay}ms`));

// Change the delay without restarting: write a number to stdin.
process.stdin.on("data", (d) => {
  const n = Number(String(d).trim());
  if (Number.isFinite(n) && n >= 0) {
    delay = n;
    console.log(`one-way delay now ${delay}ms`);
  }
});
