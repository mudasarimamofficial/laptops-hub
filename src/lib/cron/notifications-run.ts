import type { OutboxRunResult } from "@/lib/notify/outbox";

export type KeepaliveResult = { ok: boolean; mode?: string; error?: string; ping_count?: number };

/**
 * Runs daily cron work with keepalive independent of outbox success.
 * Keepalive always executes first; outbox failures are reported without undoing keepalive.
 */
export async function runNotificationsCron(deps: {
  touchKeepalive: () => Promise<KeepaliveResult>;
  processOutbox: () => Promise<OutboxRunResult>;
  countNeedsAttention: () => Promise<number>;
}): Promise<{
  status: 200 | 207;
  body: OutboxRunResult & {
    needsAttention: number | null;
    keepalive: KeepaliveResult;
    outboxError: string | null;
  };
}> {
  const keepalive = await deps.touchKeepalive();
  let result: OutboxRunResult = { configured: false, processed: 0, accepted: 0, failed: 0, lost: 0 };
  let needsAttention: number | null = null;
  let outboxError: string | null = null;
  try {
    result = await deps.processOutbox();
    needsAttention = await deps.countNeedsAttention();
  } catch (e) {
    outboxError = e instanceof Error ? e.message : "outbox_failed";
  }
  return {
    status: outboxError ? 207 : 200,
    body: { ...result, needsAttention, keepalive, outboxError },
  };
}
