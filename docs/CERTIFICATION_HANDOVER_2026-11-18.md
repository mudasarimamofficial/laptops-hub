# Laptops HUB — Production certification & handover (2026-11-18)

Branch work: `feat/certification-handover`. Starting main: `83978426b91bbabc92610be380bee919ace5a836`. Production deploy at handoff: `dpl_FpoUn99CJNgB25Duk72ZJV9BuPN4` READY.

## 1. Real production order creation and cancellation

| Check | Result |
|---|---|
| Isolated COD matrix | **23/23 PASS** |
| Live quote + fee disclosure | Verified earlier: Lahore/Punjab → Rs 360 + Rs 50, cash due shown |
| Labeled live storefront submit | **Not run** — no owner-authorized test name/phone/address in project records |
| Precise missing input | Owner-controlled test recipient: full name, Pakistani mobile (`03XXXXXXXXX`), street, city, province — clearly labeled QA / do-not-dispatch |
| Emergency pause | `store_settings.cod_checkout.enabled` (currently **true**) |

## 2. Merchant order receipt and notifications

| Check | Result |
|---|---|
| Orders in DB | **0** |
| Resend | **Not configured** (`RESEND_API_KEY` / `STORE_FROM_EMAIL` / `STORE_NOTIFY_EMAIL`) |
| Fallback | Admin Overview + Orders banners: watch Orders list; unsent mail never marked delivered |
| Staff | Active owner/admin can open `/admin/orders` |

## 3. Shipping and COD totals

All Over PK: **Rs 360** delivery (`36000` paisa) + **Rs 50** COD (`5000` paisa). Server quote authoritative.

## 4. Policy accuracy

Mandatory five published with transparent COD/availability wording; `legal_approved=true` is a CMS flag, **not** evidence of external counsel review. About / Contact / FAQ published with **no invented phone/address/registration**.

## 5. Review provenance and public attribution

| Fix | Status |
|---|---|
| Cleared `consent_confirmed` on all 37 Google rows | Done |
| Honest verification notes (HTML match ≠ consent / Maps re-verify) | Done |
| Place `cid` URL labeled “Google listing” not “View [author]'s review” | Code |
| Import script no longer auto-publishes or sets consent true | Code |
| Migration `20261118120000` — Google may publish with Maps URL without consent | Applied (30 migrations) |

## 6. Reels publication

**0** published. Checklist: `docs/REELS_ASSET_CHECKLIST.md`. Only synthetic fixture in repo.

## 7. Blog and CMS completeness

4 guides published. About/Contact/FAQ published (minimal, factual). Order-enquiries if present still CMS-editable.

## 8. Client admin access

**Blocked:** no designated client staff email in authorized records. Invite via `/admin/staff` when email provided. Do not share owner password; rotate previously shared credentials.

## 9. Product-management UX

SKU search added on Admin → Products. Existing bulk/import/export/status filters retained.

## 10. Security / a11y / performance

Unit testimonials provenance tests PASS. Isolated COD anon denials PASS. Preview COD remains off (shares prod DB).

## 11. Production commit / deployment

Update after this PR merges and Vercel finishes. Pre-PR: `8397842` / `dpl_FpoUn99…`.

## 12. Remaining blockers (exact)

1. **Owner test identity** for labeled live COD order + cancel  
2. **Resend + DNS** for notifications and staff invites  
3. **Client staff email**  
4. **Licensed reel media**  
5. Optional: individual Google review permalinks when available  
