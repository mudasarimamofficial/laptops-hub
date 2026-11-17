# 14 — Accessibility baseline

**Date:** 2026-11-17  
**Source:** Lighthouse lab scores (2026-11-16) + live page structure probes

## Lighthouse accessibility scores

| Page | Mobile | Desktop |
|---|---|---|
| Home | 100 | 100 |
| Collection | 100 | 96 |
| Product | 100 | 100 |

## Prior accessibility work (V5 completion report)

7 issues resolved in the QA pass:
- Steppers
- Unnamed links
- Contrast
- Small touch targets
- Live region
- Dialog focus (×2)

## Structural checks (live 2026-11-17)

| Check | Result |
|---|---|
| `<main>` landmark | Present on all checked pages |
| Page `<title>` | Present and descriptive (product name + specs on PDP) |
| Breadcrumbs on PDP | Present (Home / Brand / Product) |
| Form labels (inquiry form) | Present (Full name, Topic, Mobile, Email, Budget, Use, Contact pref, Message) |
| Alt text on product images | Not re-verified this session (prior V5 evidence) |
| Keyboard shortcuts (admin) | `?` shortcut help sheet, G-key navigation, Ctrl/⌘ K search |

## Not re-verified this session

- Full axe-core sweep across all routes
- Screen reader testing (NVDA, VoiceOver)
- Real device testing (iOS Safari, Android Chrome)
- Keyboard-only navigation through full checkout flow
- Color contrast ratio at all viewport sizes

## Verdict

**PASS** for Lighthouse scores and structural landmarks.  
**PARTIAL** — full axe sweep and assistive technology testing not performed this session. Prior V5 evidence covers the catalog; re-run after any visual changes.
