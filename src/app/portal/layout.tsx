import type { Metadata } from "next";
import type { ReactNode } from "react";

// The portal is a private surface: keep it out of search indexes
// (docs/overview/product-principles.md §1.3). Junto names and other private
// context are deliberately never surfaced through metadata.
export const metadata: Metadata = {
  title: "Member portal",
  robots: {
    index: false,
    follow: false,
  },
};

// Private responses are rendered per request: the authenticated user and
// live active membership are re-checked every time, and access is never
// cached as a durable UI/session fact — deactivation takes effect on the
// next request even while the Auth session remains valid.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}
