# Staging environment configuration template

> Prepared 2026-11-15. No paid service, cloud project, or shared database has been created.
> Owner approval required before provisioning any staging resource.

## Required resources (not yet provisioned)

| Resource | Purpose | Estimated cost |
|---|---|---|
| Supabase project (staging) | Isolated database with same schema | Free tier eligible |
| Vercel preview environment | Staging deployment target | Included in current plan |

## Environment variables for staging

Copy `.env.local` and override:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
SUPABASE_DB_URL=postgresql://postgres:<staging-password>@db.<staging-project-ref>.supabase.co:5432/postgres

# Keep COD disabled on staging until owner approval
COD_ENABLED=false
PUBLIC_WRITES_ENABLED=true

# Use the same fake Resend endpoint or a staging Resend key
RESEND_API_KEY=re_staging_...
```

## Migration strategy

1. Create staging Supabase project
2. Apply all migrations in order: `supabase db push --linked`
3. Run seed script: `node scripts/test-fixtures/seed-isolated.mjs`
4. Verify with: `node scripts/security-p0-probe.mjs` and `node scripts/security-auth-matrix.mjs`

## Vercel configuration

- Branch: `feat/merchant-operating-system` → preview deployment
- Environment: set staging env vars in Vercel dashboard under Preview scope
- Domain: `staging.laptopshub.pk` or Vercel preview URL

## Pre-flight checklist before provisioning

- [ ] Owner approves staging Supabase project creation
- [ ] Owner provides or approves staging domain
- [ ] Owner confirms staging should use free-tier Supabase
- [ ] All local migrations pass on clean `supabase db reset`
- [ ] Release suite passes locally (this document assumes it does)
