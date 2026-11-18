/** Merchant-readable labels for audit_logs.action values. */
const LABELS: Record<string, string> = {
  "post.create": "Created blog post",
  "post.update": "Updated blog post",
  "post.delete": "Deleted blog post",
  "cms_media.upload": "Uploaded CMS image",
  "product_media.add": "Added product image",
  "product_media.delete": "Removed product image",
  "product_media.reorder": "Reordered product images",
  "navigation.publish": "Published navigation",
  "navigation.restore_defaults": "Reset navigation to defaults",
  "store_settings.update": "Updated store settings",
  "shipping_zone.update": "Updated shipping zone",
  "shipping_zone.create": "Created shipping zone",
  "order.status": "Changed order status",
  "cod.collect": "Recorded COD collection",
  "staff.invite": "Invited staff",
  "staff.deactivate": "Deactivated staff",
  "staff.activate": "Activated staff",
  "staff.role": "Changed staff role",
  "backup.create": "Created CMS snapshot",
  "backup.restore": "Restored CMS snapshot",
  "content.update": "Updated CMS page",
  "reel.create": "Created reel",
  "reel.update": "Updated reel",
  "theme.homepage.save": "Saved homepage draft",
  "theme.homepage.publish": "Published homepage",
};

export function auditActionLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
