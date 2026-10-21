export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--lh-canvas)]">
      <div className="border-b border-[var(--lh-border)] bg-white">
        <div className="lh-container flex h-14 items-center justify-between">
          <p className="font-[family-name:var(--font-display)] font-bold tracking-[-0.03em]">
            Laptops <span className="rounded bg-[var(--lh-signal)] px-1.5 text-white">HUB</span> Admin
          </p>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--lh-ink-2)]">
            Staff only
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
