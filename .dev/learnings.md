# Dev learnings

Add only verified, non-obvious knowledge likely to prevent repeated mistakes across runs.

- This host has Docker Engine and a complete Supabase CLI installation in `~/.local/bin`. Docker's daemon defaults both the built-in bridge and newly created bridge networks to publish unspecified ports on `127.0.0.1`, so ordinary `supabase start` is loopback-only.
