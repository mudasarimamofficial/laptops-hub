const TONES: Record<string, { bg: string; fg: string; label?: string }> = {
  active: { bg: "var(--adm-success-bg)", fg: "var(--adm-success)", label: "Active" },
  published: { bg: "var(--adm-success-bg)", fg: "var(--adm-success)", label: "Published" },
  draft: { bg: "var(--adm-warning-bg)", fg: "var(--adm-warning)", label: "Draft" },
  pending: { bg: "var(--adm-warning-bg)", fg: "var(--adm-warning)", label: "Pending" },
  scheduled: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Scheduled" },

  archived: { bg: "var(--adm-surface-2)", fg: "var(--adm-ink-2)", label: "Archived" },
  deleted: { bg: "var(--adm-danger-bg)", fg: "var(--adm-danger)", label: "Deleted" },
  placed: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Placed" },
  pending_confirmation: { bg: "var(--adm-warning-bg)", fg: "var(--adm-warning)", label: "Awaiting confirm" },
  confirmed: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Confirmed" },
  packing: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Packing" },
  shipped: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Shipped" },
  delivered: { bg: "var(--adm-success-bg)", fg: "var(--adm-success)", label: "Delivered" },
  cancelled: { bg: "var(--adm-surface-2)", fg: "var(--adm-ink-2)", label: "Cancelled" },
  returned: { bg: "var(--adm-danger-bg)", fg: "var(--adm-danger)", label: "Returned" },
  failed: { bg: "var(--adm-danger-bg)", fg: "var(--adm-danger)", label: "Failed" },
  tracked: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "Tracked" },
  untracked: { bg: "var(--adm-surface-2)", fg: "var(--adm-ink-2)", label: "Confirm availability" },
  new: { bg: "var(--adm-info-bg)", fg: "var(--adm-action)", label: "New" },
  handling: { bg: "var(--adm-warning-bg)", fg: "var(--adm-warning)", label: "Handling" },
  closed: { bg: "var(--adm-surface-2)", fg: "var(--adm-ink-2)", label: "Closed" },
};

export function StatusBadge({ status, children }: { status: string; children?: React.ReactNode }) {
  const tone = TONES[status] ?? { bg: "var(--adm-surface-2)", fg: "var(--adm-ink-2)" };
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {children ?? tone.label ?? status.replace(/_/g, " ")}
    </span>
  );
}
