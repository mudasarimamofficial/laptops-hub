# 15 — Merchant guide: changing the homepage yourself

For the store owner and staff. No code, no developer needed.

## Who can do what
| Role | Edit and save drafts | Publish / restore versions |
|---|---|---|
| Owner, Admin | Yes | Yes |
| Editor | Yes | No (asks an owner/admin) |
| Fulfillment, Manager | No | No |

## Change text or a button on the homepage
1. Sign in at `https://www.laptopshub.pk/admin/login`.
2. Open **Online Store** in the left menu.
3. In **Sections**, click the part of the page you want to change (for example *Cinematic hero* or *Brands*).
4. In the settings panel, type the new text. The grey text inside an empty box is what customers see now (the
   default). Leave a box empty to keep the default.
5. Button links: use a page of this site such as `/collections/all` or `/pages/about`, a section such as `#brands`,
   or a full `https://` link. A red message means the link is not allowed; fix it before saving.
6. Click **Save draft**. Customers do not see drafts.
7. Use the **Desktop / Tablet / Mobile** buttons above the preview, or **Open full preview**, to check the page.
8. Click **Publish to live site** and confirm. Customers see the new homepage within about a minute.

## Undo
- One field: click **Reset to default** next to it, then Save draft and Publish.
- Whole page: under **Published history**, click **Restore this version** on an earlier version. The live homepage goes back
  within about a minute. Nothing is deleted; you can restore the newer version again later.

## Move or hide a section
Use the arrows next to a section to move it. To hide it, select it and untick **Show on the homepage**. The hero always stays first and the map always
stays last (they are built that way). Save draft → Preview → Publish.

## Change the header, menu, footer or promotion-bar text (all pages)
1. Online Store → click **Header & footer** (marked "All pages") above the section list.
2. Edit any field. The grey text in an empty box is what customers see now; **Reset to default** brings it back.
   - Header & menu: the "Laptops" menu button, the search box text, the menu's "View all products" and second link.
   - Footer: the short description under the logo, the "Visit & contact" heading, the WhatsApp button text.
   - Promotion bar: the button text and where it goes (the promotion text itself is set in Discounts).
3. **Save draft**, then **Publish to live site**. Customers see the change on every page within about a minute.
   Restoring an earlier version under *Published history* restores this text as well.
4. The full preview shows homepage sections only; its header and footer still show the live text until you publish.
5. Links must be a page on this site (for example `/collections/gaming-laptops`) or a full `https://` link.

## Page title ending (SEO)
Settings → **SEO title suffix**: what follows every page title in Google and browser tabs, e.g. `| Laptops HUB`.
Leave it empty to keep the standard "· Laptops HUB".

## If someone else edited at the same time
If you see "Someone else saved this homepage draft after you opened the editor": choose **Cancel** and reload the page
to see their changes (recommended), or **OK** to replace their draft with yours.

## Where other things are edited
| What | Where |
|---|---|
| Phone numbers, address, email, social links, WhatsApp | Settings → Contact & social (footer and homepage inquiry use the same list) |
| Header links and footer columns | Navigation |
| Sale banner text (5% campaign) | Discounts |
| Reels heading and videos | Merchandising / Reels |
| Customer reviews on the homepage | Reviews → Store testimonials |
| Catalog counts and section numbers on/off | Settings → Storefront labels |

## Not editable yet without a developer
Product-page, collection-page, cart/checkout and 404 wording; the mega-menu groups; site colours and fonts. These are listed as Phase 2 in `05_THEME_EDITOR_SPEC_AND_ACCEPTANCE.md`.
