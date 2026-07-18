# Dev learnings

Add only verified, non-obvious knowledge likely to prevent repeated mistakes across runs.

- This host has Docker Engine and a complete Supabase CLI installation in `~/.local/bin`. Junto's `db:start` uses the `junto-local` Docker network so published Supabase ports bind only to `127.0.0.1`; database tests must use the same network ID.
