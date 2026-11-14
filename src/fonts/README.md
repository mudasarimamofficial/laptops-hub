# Self-hosted fonts

V5 font set (Hanken Grotesk, Sora, JetBrains Mono), latin subset, variable `wght` axis, WOFF2.
Source: Google Fonts CDN (fonts.gstatic.com) — hankengrotesk/v12, sora/v17, jetbrainsmono/v24, downloaded 2026-11-14.
License: SIL Open Font License 1.1 (all three families).

Why local: `next/font/google` fetches Google Fonts at build time. On 2026-11-14 Google returned extension-less
`/l/font?kit=…` URLs for JetBrains Mono during builds, which Next 16.4.2's loader cannot parse, so every build
failed. Local files remove that network dependency from the build (same families, latin subset, as before).
