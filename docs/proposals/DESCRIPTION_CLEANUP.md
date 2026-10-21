# Proposal (NOT APPLIED): remove internal wording from public product descriptions

Status: **awaiting owner approval.** Nothing has been written to the database. This file is not a migration; do not copy it into `supabase/migrations/`.

## Correction to the earlier report
The Phase 1 report said "96 of 232 intro texts contain internal CRM wording". **That was wrong.** The 96 came from a bug in my own display filter: it missed generated spec paragraphs whose values contain " · ". The filter is fixed, and a unit test now covers that case.

The correct finding has two parts:
- **3 products** have internal CRM wording in their curated intro text.
- **171 products** had a generated `key: value` paragraph appended to `description_safe` by the importer, with internal labels such as `Memory (CRM config)`. The storefront now hides this paragraph at display time (`publicDescription`), and the importer no longer writes it. The rows already in the database still contain it.

Source: local catalog snapshot `data/lh-catalog.js` (232 products). Live database contents not verified (no Supabase access from the design session).

## A. Three intro texts (owner wording decision)
Proposed edits only remove the internal label or note. They add no facts.

| Handle | Current (public today) | Proposed |
|---|---|---|
| `dell-latitude-5470-core-i3-6th-gen-4gb-ram-180gb-storage` | Dell Latitude 5470 / E5470 business notebook. CRM configuration: Intel Core i3 6th Generation, 4GB RAM, 180GB storage. | Dell Latitude 5470 / E5470 business notebook. Configuration: Intel Core i3 6th Generation, 4GB RAM, 180GB storage. |
| `hp-probook-640-g2-core-i3-6th-gen-4gb-ram-180gb-storage` | HP ProBook 640 G2. CRM: Core i3 6th Gen, 4GB RAM, 180GB (CRM CPU tier wins over common i5 listings). | HP ProBook 640 G2. Configuration: Core i3 6th Gen, 4GB RAM, 180GB. |
| `dell-latitude-5470-i3-6th-4-128-sku-00066` | Dell Latitude 5470. CRM: Core i3 6th Gen, 4GB RAM, 128GB. | Dell Latitude 5470. Configuration: Core i3 6th Gen, 4GB RAM, 128GB. |

The owner can approve, edit or reject each row. The HP note, "CRM CPU tier wins over common i5 listings", means the listing's CPU tier came from the CRM rather than other listings. The owner should confirm the Core i3 configuration is correct before publishing.

## B. 171 generated spec paragraphs (optional data cleanup)
Display is already fixed in code. Cleaning the stored rows removes the internal labels from the raw `description_safe` column, which anon can still read through the Supabase REST API.

## Reversible SQL (run only after approval, in a transaction, by the owner or a lead engineer)
```sql
BEGIN;
-- 1. Backup (kept until the owner signs off)
CREATE TABLE IF NOT EXISTS public._backup_description_cleanup_20261021 AS
SELECT id, handle, description_safe, now() AS backed_up_at
FROM public.products
WHERE description_safe ~ '(CRM|source reference)';
REVOKE ALL ON public._backup_description_cleanup_20261021 FROM anon, authenticated;

-- 2A. Approved intro rewrites. The guard on the exact current text means nothing changes if live data differs.
UPDATE public.products SET description_safe = 'Dell Latitude 5470 / E5470 business notebook. Configuration: Intel Core i3 6th Generation, 4GB RAM, 180GB storage.'
WHERE handle = 'dell-latitude-5470-core-i3-6th-gen-4gb-ram-180gb-storage'
  AND description_safe = 'Dell Latitude 5470 / E5470 business notebook. CRM configuration: Intel Core i3 6th Generation, 4GB RAM, 180GB storage.';
UPDATE public.products SET description_safe = 'HP ProBook 640 G2. Configuration: Core i3 6th Gen, 4GB RAM, 180GB.'
WHERE handle = 'hp-probook-640-g2-core-i3-6th-gen-4gb-ram-180gb-storage'
  AND description_safe = 'HP ProBook 640 G2. CRM: Core i3 6th Gen, 4GB RAM, 180GB (CRM CPU tier wins over common i5 listings).';
UPDATE public.products SET description_safe = 'Dell Latitude 5470. Configuration: Core i3 6th Gen, 4GB RAM, 128GB.'
WHERE handle = 'dell-latitude-5470-i3-6th-4-128-sku-00066'
  AND description_safe = 'Dell Latitude 5470. CRM: Core i3 6th Gen, 4GB RAM, 128GB.';

-- 2B. Drop the generated paragraph (everything from the last blank line, only when it starts with a known generated key).
UPDATE public.products
SET description_safe = regexp_replace(description_safe, E'\\n\\n(Processor|Memory \\(CRM config\\)|Storage \\(CRM config\\)|Graphics|Display|Resolution / panel|Touch|Operating system \\(source reference\\)|Condition|Memory \\(source reference\\)|Storage \\(source reference\\)): [^\\n]*$', '')
WHERE description_safe ~ E'\\n\\n(Processor|Memory \\(CRM config\\)|Storage \\(CRM config\\)|Graphics|Display|Resolution / panel|Touch|Operating system \\(source reference\\)|Condition|Memory \\(source reference\\)|Storage \\(source reference\\)): ';
-- Rows whose description is ONLY the generated paragraph (no intro) need the same with no leading blank line:
UPDATE public.products
SET description_safe = ''
WHERE description_safe ~ '^(Processor|Memory \(CRM config\)|Storage \(CRM config\)|Graphics|Display|Resolution / panel|Touch|Operating system \(source reference\)|Condition|Memory \(source reference\)|Storage \(source reference\)): [^\n]*$';

-- 3. Verify before COMMIT: expect 0
SELECT count(*) FROM public.products WHERE description_safe ~ '(CRM|source reference)';
COMMIT;   -- or ROLLBACK;

-- Rollback after commit:
-- UPDATE public.products p SET description_safe = b.description_safe
-- FROM public._backup_description_cleanup_20261021 b WHERE b.id = p.id;
```

## Not in scope of this proposal
- Raw `specs` JSON keys (`Memory (CRM config)`, `Operating system (source reference)`) remain readable through the public Supabase REST API and `/api/catalog/product`. The UI no longer displays them. Renaming the keys is a separate, owner-approved data change: it touches the importer, `curateSpecs` and the compare page together.
