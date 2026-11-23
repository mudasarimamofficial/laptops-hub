"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DiscountCampaign } from "@/lib/commerce/pricing";
import { formatPkr } from "@/lib/money";
import { applyPercentOff, applyFixedOff } from "@/lib/commerce/pricing";

export function DiscountCampaignForm({ initial }: { initial: DiscountCampaign[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiscountCampaign | null>(initial.find((c) => c.name === "Storewide 5% Off") || initial[0] || null);
  const [previewListPkr, setPreviewListPkr] = useState(10000);

  async function save(campaign: Partial<DiscountCampaign> & { name: string; kind: DiscountCampaign["kind"]; value: number; status: DiscountCampaign["status"] }) {
    setError(null);
    const res = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description || "",
        kind: campaign.kind,
        value: campaign.value,
        scope: campaign.scope || "storewide",
        status: campaign.status,
        startsAt: campaign.startsAt || null,
        endsAt: campaign.endsAt || null,
        announcement: campaign.announcement || "",
        showAnnouncement: campaign.showAnnouncement !== false,
        codeRequired: false,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    const saved = json.campaign as DiscountCampaign;
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === saved.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditing(saved);
    start(() => router.refresh());
  }

  const preview =
    editing?.kind === "fixed_paisa"
      ? applyFixedOff(Math.round(previewListPkr * 100), editing.value)
      : applyPercentOff(Math.round(previewListPkr * 100), editing?.value || 0);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error ? (
        <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "#FEE2E2", color: "#991B1B", fontSize: 14 }}>
          {error}
        </p>
      ) : null}

      <section className="adm-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Campaigns</h2>
        <div className="adm-table-scroll">
          <table className="adm-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Value</th>
                <th align="left">Status</th>
                <th align="left">Scope</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.kind === "percent" ? `${c.value}%` : formatPkr(c.value)}</td>
                  <td>{c.status}</td>
                  <td>{c.scope}</td>
                  <td>
                    <button type="button" className="adm-btn" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5}>No campaigns yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          onClick={() =>
            setEditing({
              id: "",
              name: "New discount",
              description: "",
              kind: "percent",
              value: 5,
              scope: "storewide",
              status: "draft",
              startsAt: null,
              endsAt: null,
              announcement: "",
              showAnnouncement: true,
              codeRequired: false,
            })
          }
        >
          Create discount
        </button>
      </section>

      {editing ? (
        <section className="adm-card" style={{ padding: 16, display: "grid", gap: 14, maxWidth: 560 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{editing.id ? "Edit campaign" : "New campaign"}</h2>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Name
            <input
              className="adm-input"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Description
            <textarea
              className="adm-input"
              rows={2}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </label>
          <div className="adm-discount-fields" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Type
              <select
                className="adm-input"
                value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value as DiscountCampaign["kind"] })}
              >
                <option value="percent">Percentage</option>
                <option value="fixed_paisa">Fixed amount (paisa)</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Value {editing.kind === "percent" ? "(%)" : "(paisa)"}
              <input
                className="adm-input"
                type="number"
                min={1}
                max={editing.kind === "percent" ? 90 : undefined}
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Status
            <select
              className="adm-input"
              value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as DiscountCampaign["status"] })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="disabled">Disabled</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <p style={{ margin: 0, fontSize: 12, color: "var(--adm-muted, #64748B)" }}>
            Scope is storewide only. Product/collection targeting is disabled until it is fully supported in
            checkout and storefront pricing.
          </p>
          <div className="adm-discount-fields" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Starts at (UTC, optional)
              <input
                className="adm-input"
                type="datetime-local"
                value={editing.startsAt ? editing.startsAt.slice(0, 16) : ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Ends at (UTC, optional)
              <input
                className="adm-input"
                type="datetime-local"
                value={editing.endsAt ? editing.endsAt.slice(0, 16) : ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </label>
          </div>
          {editing.status === "scheduled" && !editing.startsAt ? (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: "#991B1B" }}>
              Scheduled campaigns require a start time.
            </p>
          ) : null}
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Announcement bar text
            <input
              className="adm-input"
              value={editing.announcement}
              onChange={(e) => setEditing({ ...editing, announcement: e.target.value })}
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={editing.showAnnouncement}
              onChange={(e) => setEditing({ ...editing, showAnnouncement: e.target.checked })}
            />
            Show storefront announcement
          </label>
          <div style={{ padding: 12, borderRadius: 12, background: "var(--adm-surface-2, #F4F7FB)", display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Price preview</strong>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Sample list price (Rs)
              <input
                className="adm-input"
                type="number"
                min={1}
                value={previewListPkr}
                onChange={(e) => setPreviewListPkr(Number(e.target.value) || 0)}
              />
            </label>
            <p style={{ margin: 0, fontSize: 14 }}>
              List {formatPkr(preview.listPaisa)} → <strong>{formatPkr(preview.sellingPaisa)}</strong>
              {preview.discountPaisa > 0 ? ` (save ${formatPkr(preview.discountPaisa)})` : ""}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={
                pending ||
                !editing.name.trim() ||
                editing.value <= 0 ||
                (editing.status === "scheduled" && !editing.startsAt)
              }
              onClick={() => void save({ ...editing, scope: "storewide" })}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {editing.status === "active" ? (
              <button
                type="button"
                className="adm-btn"
                disabled={pending}
                onClick={() => void save({ ...editing, status: "disabled" })}
              >
                Disable
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn"
                disabled={pending || !editing.id}
                onClick={() => void save({ ...editing, status: "active" })}
              >
                Activate
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--adm-muted, #64748B)" }}>
            Automatic campaigns apply once to catalog list prices. Shipping and COD fees are never discounted.
            Disabling a campaign does not rewrite past orders.
          </p>
        </section>
      ) : null}
    </div>
  );
}
