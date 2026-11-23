import assert from "node:assert/strict";
import { runNotificationsCron } from "../../src/lib/cron/notifications-run";

async function main() {
  const order: string[] = [];
  const failed = await runNotificationsCron({
    touchKeepalive: async () => {
      order.push("keepalive");
      return { ok: true, mode: "touch_keepalive", ping_count: 3 };
    },
    processOutbox: async () => {
      order.push("outbox");
      throw new Error("provider_down");
    },
    countNeedsAttention: async () => {
      order.push("count");
      return 0;
    },
  });
  assert.equal(failed.status, 207);
  assert.equal(failed.body.keepalive.ok, true);
  assert.equal(failed.body.keepalive.ping_count, 3);
  assert.equal(failed.body.outboxError, "provider_down");
  assert.deepEqual(order, ["keepalive", "outbox"], "keepalive must run before outbox; count skipped on throw");

  const ok = await runNotificationsCron({
    touchKeepalive: async () => ({ ok: true, mode: "touch_keepalive", ping_count: 4 }),
    processOutbox: async () => ({ configured: true, processed: 2, accepted: 2, failed: 0, lost: 0 }),
    countNeedsAttention: async () => 1,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.processed, 2);
  assert.equal(ok.body.needsAttention, 1);
  assert.equal(ok.body.outboxError, null);

  console.log("cron-notifications-keepalive: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
