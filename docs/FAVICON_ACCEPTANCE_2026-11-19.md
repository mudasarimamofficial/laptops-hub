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
- Al Hafiz Enterprises: **not modified**.
