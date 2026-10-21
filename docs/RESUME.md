# Resume here

State: **P0 admin authorization FIXED & verified** (2026-10-21). COD still gated. V5 cinematic parity and full admin mutations remain next.

## HEAD / cloud
- GitHub `main` — push P0 security commit after this session checkpoint
- Supabase `xvmmjkrkgznnakcobmww` — migrations through `20261021130000_p0_security_hardening`
- Catalog DB: **232 / 226 / 6 / 964** preserved
- Vercel `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` — preview only; **no prod promote without owner approval**
- Flags: `COD_CHECKOUT_ENABLED=false`

## P0 evidence
- `docs/SECURITY_P0_REVIEW.md`
- `npm run test:security:p0` → **9/9 PASS**
- `npm run test:unit` → pass (incl. staff role allow-list)

## Owner action required
Bootstrap first staff row (no self-service):
```sql
insert into public.admin_memberships (user_id, role, is_active)
values ('<auth.users.id>', 'owner', true);
```

## Next (authorized)
1. COD checkout UX: remove zone UUID; server quote + city/province match
2. V5 cinematic hero/story + visual parity doc
3. Data-driven collections, full cards, compare tray
4. Admin CRUD / order transitions / COD collection / CMS
5. Playwright + RLS E2E; preview verify; launch docs — still no `--prod`
