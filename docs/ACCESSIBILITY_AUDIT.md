# Accessibility audit

Automated scan (`qa/lh-functional.js`, 10 routes + mobile targets): 14/14 pass. Defects fixed this pass are #3–8 in FINAL_QA_REPORT.md.

## In place (verified)
- Landmarks: header, nav (Primary, Mobile, Breadcrumb), main, aside, footer, article
- Exactly one H1 per route (20 content/utility routes + all templates); no skipped heading levels
- `:focus-visible` 2px outline on all focusable elements
- Dialogs (cart, search, mobile nav, inquiry, mobile filters): role=dialog + aria-modal, focus moves into the newest dialog, Tab and Shift+Tab trapped, Esc closes, focus returns to the opener, body scroll locked and restored
- Forms: wrapping labels, aria-invalid, errors in aria-live regions; demo-only result uses role=status
- Toasts announced through a persistent visually hidden live region
- aria-pressed on compare + story chapters; aria-expanded on mega menu and accordions; aria-current on nav, side links, gallery thumbnails
- prefers-reduced-motion: no intro, story unpinned as a 4-image grid with all specs visible, transitions off
- Touch targets: header, dialogs, steppers 44×44; text links in section headers 44px tall
- Images: product alt = model + configuration + "photo n of N"; decorative layers aria-hidden; duplicate image links hidden from assistive tech
- Text contrast ≥4.5:1 (≥3:1 for large) on solid backgrounds across scanned routes

## Open
| Item | Note |
|---|---|
| Screen-reader pass | VoiceOver (iOS/macOS), NVDA, TalkBack required |
| Text over gradients/photos | Not machine-checkable here; review visually |
| Mega menu arrow keys | Optional roving tabindex |
| Catalog alt text | Derived; descriptive alt should be written at import |
