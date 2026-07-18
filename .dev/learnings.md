# Dev learnings

Add only verified, non-obvious knowledge likely to prevent repeated mistakes across runs.

- This execution host has Supabase CLI but no Docker, so `supabase test db` cannot connect to the local Postgres stack. Run database verification in a Docker-capable environment rather than treating the explicit connection failure as a product-test result.
