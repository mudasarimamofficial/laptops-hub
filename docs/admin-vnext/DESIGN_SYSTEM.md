# Admin VNext — design system (Release A)

Foundation lives in `src/styles/admin.css` under `--adm-*`.

## Surfaces & ink

- Canvas `--adm-canvas`, surfaces `--adm-surface` / `--adm-surface-2` / `--adm-surface-elevated`
- Text `--adm-ink`, `--adm-ink-2`, `--adm-ink-muted`
- Borders `--adm-border`, `--adm-border-strong`, `--adm-divider`
- Action `--adm-action` / `--adm-action-hover`, focus `--adm-focus`
- Status: success / warning / danger / info (+ `*-bg`)

## Spacing & shape

- Scale: `--adm-space-1`…`--adm-space-6` (4–24px)
- Radii: `--adm-radius-sm` 6 / `--adm-radius` 10 / `--adm-radius-lg` 14
- Editor aside width: `--adm-editor-aside` 320px
- Sidebar: `--adm-sidebar-w` 248px · Topbar: `--adm-topbar-h` 56px

## Shared primitives (Release A)

| Capability | Component |
|---|---|
| Page chrome | existing `AdminShell` / `AdminPageHeader` |
| Card | `AdminCard` |
| Two-column editor | `AdminEditorLayout` |
| Fields | `AdminField` + `admInputClass` |
| Save feedback | `AdminSaveBar` |
| Media select | `AdminMediaPicker` + `GET /api/admin/media/library` |

Admin desks must not introduce storefront-only tokens (`lh-container`, random storefront form chrome) for primary layouts.
