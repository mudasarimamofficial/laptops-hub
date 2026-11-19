# Laptops HUB — Favicon acceptance (2026-11-19)

## Source (authoritative)

- URL: `https://xvmmjkrkgznnakcobmww.supabase.co/storage/v1/object/public/cms-media/laptop%20hub%20fav%20icon.webp`
- Inspected: **1254×1254** WebP, sRGB, no alpha channel (solid white canvas), square aspect

## Generated static App Router assets

| File | Size | Role |
| --- | ---: | --- |
| `src/app/favicon.ico` | multi-res **16 / 32 / 48** PNG-in-ICO | Classic tab favicon (`sizes=any`) |
| `src/app/icon.png` | **192×192** PNG | Modern browser icon |
| `src/app/apple-icon.png` | **180×180** PNG | Apple touch / home-screen |

Generation notes:

- Near-white margins trimmed (content ~890×363) then fitted into square with ~6% padding — **no stretch**, no redesign.
- Artwork remains the official L + red HUB pill.
- Served as static app files (not remote Supabase URL on every favicon request).
- No duplicate `metadata.icons` entries in `layout.tsx` (file-based conventions only).

## Scope

- Global via shared `src/app/layout.tsx` + App Router icon files → storefront **and** admin inherit the same icons.
- Header / wordmark logo unchanged.
- Al Hafiz Enterprises: **not modified** (repo HEAD remains independent; no LH favicon work pushed there).

## Production verification (2026-11-19)

| Check | Result |
| --- | --- |
| PR | [#50](https://github.com/mudasarimamofficial/laptops-hub/pull/50) merged |
| SHA | `dff6ba4869234b39ba5059333ff336dda4edc4bc` |
| Deploy | `dpl_DoQMyFxj78N9y6Q5tpSCS64uWmyC` **READY** |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk` (apex 308 → www) |
| HTML icons | `/favicon.ico` (x-icon), `/icon.png` 192, `/apple-icon.png` 180 with content-hash query |
| Asset SHA256 | www + apex→www match repo files for ico/png/apple |
| Admin login HTML | same three icon link tags |
| MIME | `image/vnd.microsoft.icon` for favicon.ico after redirect |
| Evidence | `docs/visual-evidence/favicon-2026-11-19/` |
