// Canonical routing decisions (.dev/runs/core-product/implementation.md,
// "Decisions and boundaries"): chapter pages live under /juntos/[juntoSlug]
// and essay pages under /essays/[essaySlug]. Later tasks implement those
// dynamic pages; nothing may invent competing URL shapes in the meantime.
export const routes = {
  home: "/",
  essays: "/essays",
  meetings: "/meetings",
  authors: "/authors",
  about: "/about",
  portal: "/portal",
  junto(juntoSlug: string): string {
    return `/juntos/${encodeURIComponent(juntoSlug)}`;
  },
  essay(essaySlug: string): string {
    return `/essays/${encodeURIComponent(essaySlug)}`;
  },
} as const;
