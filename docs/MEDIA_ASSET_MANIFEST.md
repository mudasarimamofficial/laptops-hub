# Media asset manifest

## Product images
**964 image references** across 232 products (956 on the 226 public listings; 4 drafts have none), Shopify CDN URLs, order = CSV `Image Position`. No URL is shared between products (verified by `QA Catalog.html`).

Rights tags (all 232): PENDING_OEM 147 · MEDIA_PENDING_RIGHTS_REVIEW 65 · no media tag 14 (import `final-14-v3`) · NONE 6. **No image is rights-cleared.** Review every flag before production publication. The `showFlags` prop shows the tag on cards for owner review.

Verified on all 226 public PDPs: primary image = that product's first CSV image; thumbnail count = image count.

## Local assets
| Path | Use | Source |
|---|---|---|
| assets/cut/dell7420-0..3.png | Hero main laptop + 4 story angles (Latitude 7420) | cutouts of catalog photos — rights pending |
| assets/cut/hp640g2-0.png | Hero side laptop (ProBook 640 G2) | same |
| assets/cut/t580-0.png | Hero side laptop (ThinkPad T580) | same |
| assets/scene/stage.png | Hero stage floor | generated in project |

Homepage Chromebook section uses the HP Chromebook 14 G5's first catalog photo (rights: PENDING_OEM).

## Loading strategy
Card images lazy; hero, mega feature, PDP main, cart and compare thumbnails eager. Cards load the second image only on hover. LHImg hides failed images and keeps the tile background.

## Missing media
OG/social image; favicon; brand-approved campaign photography; transparent packshot for the Chromebook section.
