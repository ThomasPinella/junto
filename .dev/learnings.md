# Dev learnings

Add only verified, non-obvious knowledge likely to prevent repeated mistakes across runs.

- This host has Docker Engine and a complete Supabase CLI installation in `~/.local/bin`. Start the local stack before `supabase test db`; stop it afterward because the default local services bind to `0.0.0.0` on this VPS.
