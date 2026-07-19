// Portal navigation per docs/experience/member-portal.md, scoped to the
// selected Junto. Chat is deliberately absent: it is outside this run and
// must not be falsely shipped. Admin appears only when the SELECTED
// membership itself carries the admin role — admin status in one Junto
// grants nothing in another (docs/membership/user-roles.md §2).
export type PortalRole = "member" | "admin";

export type PortalHref = `/portal/${string}`;

export interface PortalNavItem {
  label: string;
  href: PortalHref;
}

export function portalNavItems(
  juntoSlug: string,
  role: PortalRole,
): PortalNavItem[] {
  const base: PortalHref = `/portal/${encodeURIComponent(juntoSlug)}`;
  const items: PortalNavItem[] = [
    { label: "Home", href: base },
    { label: "Meetings", href: `${base}/meetings` },
    { label: "Essays", href: `${base}/essays` },
    { label: "Members", href: `${base}/members` },
    { label: "Profile", href: `${base}/profile` },
  ];
  if (role === "admin") {
    items.push({ label: "Admin", href: `${base}/admin` });
  }
  return items;
}
