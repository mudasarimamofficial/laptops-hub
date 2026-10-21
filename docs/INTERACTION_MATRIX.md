# Interaction matrix

| Element | Trigger | Result / state | Keyboard | Mobile | Error / edge |
|---|---|---|---|---|---|
| Laptops (mega) | hover / click | mega opens; leaves header → closes | Enter/Space toggles; Esc closes | hidden; hamburger instead | — |
| Mega links | click | route, menu closes | Tab order | accordion | — |
| Nav links | click | route; aria-current + ice bg when active | ✓ | in drawer | shown ≥1180px |
| Search button | click | overlay, input focused, body locked | Enter → results page; Esc closes; focus returns | icon button | no-results message |
| Search suggestion | click | fills query | ✓ | ✓ | — |
| Compare (header/card/PDP) | click | toggles item; count, tray update; persisted | ✓ aria-pressed | ✓ | 5th → toast "up to 4" |
| Add to cart | click | line added/merged, drawer opens, persisted | ✓ | ✓ | over stock → capped + toast |
| Qty −/+ (PDP, cart) | click | changes qty; 0 removes (cart) | ✓ | 38–48px targets | max enforced |
| Ask about availability | click | inquiry dialog | focus moves in; Tab trapped; Esc | ✓ | name/phone validation |
| Filters | checkbox/radio | results + counts recompute; chips | ✓ | drawer + "Show N results" | no matches state |
| Chip ×, Clear all | click | removes filter(s) | ✓ | ✓ | — |
| Sort | select | reorders | ✓ | ✓ | — |
| Load more | click | +12 | ✓ | ✓ | hidden at end |
| Gallery arrows / thumbs / swipe | click / swipe | changes image, counter | ✓ | swipe 40px | wraps |
| Story chapters | click | scrolls to chapter; RM: switches image | ✓ aria-pressed | ✓ | — |
| Skip intro | click | ends entrance | ✓ | hidden | shown only during intro |
| Row arrows | click | scroll 600px | ✓ | native scroll | — |
| FAQ question | click | expand/collapse, aria-expanded | ✓ | ✓ | pending answers flagged |
| TOC (content pages) | click | smooth scroll (instant under RM) | ✓ | aside below content | — |
| Contact form | submit | validate; save locally; success state | errors aria-live, aria-invalid | ✓ | not delivered (stated) |
| Cart drawer | open/close | body locked; focus in/out | Esc, Tab trap | full width | empty state |
| Checkout | — | disabled, labelled integration boundary | — | — | — |
| Browser back/forward | history | hash route restored; filters reset on route change | — | — | — |
