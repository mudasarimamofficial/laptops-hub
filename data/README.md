# Local catalog sources (not committed)

Place these files locally (they are gitignored on the public repo):

- `lh-catalog.js` — generated catalog snapshot (232 products)
- `lh-content.js` — pending content blocks
- `source/products_export_final.csv` — original Shopify export (contains cost/CRM fields)

Import:

```bash
npm run import:catalog:dry
npm run import:catalog
```

After import, Supabase is the live source of truth. Preview/production apps read products from Supabase, not these files.
