# R03 re-reconciliation — corrected T01 security range

- Range: `a16b63504c66445b57ad11a296e0a3baffbd6efa..fbced9a6161f3461fc111f78411392ad004bed82`
- Verdict: **Clean; integrate**

## Resolution

1. **Reserved `sign-in` route collision — resolved.** Exact `sign-in` is rejected by the server parser. The RPC performs live-admin authorization first, then rejects it as invalid input. An additive `NOT VALID` table constraint prevents future direct inserts/updates from introducing the route collision without scanning, rewriting, or rejecting existing rows during migration. Normal valid slugs remain accepted and safe error mapping is unchanged.

2. **Authorization-order proof — resolved.** Focused pgTAP fixtures establish a real active ordinary member and inactive former admin with authenticated role/JWT identity. Each receives `42501` for private existing-slug, malformed-slug, reserved-slug, and all-null probes. Full-table hashes captured outside RLS and compared after each caller meaningfully prove no chapter or membership state changes. The trusted direct-update case proves constraint enforcement and statement rollback.

## New blockers

None. Docs, code, and tests agree; no regression or scope expansion found.

## Evidence limitations

No writable checks rerun in this read-only review. The reported 45/45 focused pgTAP, 398 full database assertions, 15 focused unit tests, static checks, and cleanup evidence are internally consistent. Upgrade compatibility rests on the inspected `NOT VALID` structure and installed `convalidated = false`, not row-survival fixtures seeded after migration. No corrected-head build/live rerun was required because C04 changed only bounded validation, migration, tests, and one doc; accepted C01 build/live evidence still applies.

## Recommendation

Integrate corrected result `fbced9a6161f3461fc111f78411392ad004bed82`. No further T01 correction required.
