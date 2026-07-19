// Server-side portal authorization. Every private request derives access
// from the authenticated Supabase user and the LIVE active membership for
// the selected Junto — re-queried on each request so deactivation takes
// effect on the very next request, never cached as a durable UI/session
// fact. A selected slug is routing input only; it grants nothing until it
// resolves to an active membership visible through RLS.
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { routes } from "@/config/routes";
import type { ActiveMembership } from "@/lib/memberships";
import { listActiveMemberships } from "@/lib/memberships";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";

export interface PortalContext {
  supabase: SupabaseServerClient;
  userId: string;
  memberships: ActiveMembership[];
}

// react cache() dedupes the auth/membership round-trips WITHIN one request
// render (layout + page both authorize); it never persists across requests.
const loadPortalContext = cache(async (): Promise<PortalContext | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  if (!user) {
    return null;
  }
  const memberships = await listActiveMemberships(supabase, user.id);
  return { supabase, userId: user.id, memberships };
});

export async function requirePortalUser(
  nextPath?: string,
): Promise<PortalContext> {
  const context = await loadPortalContext();
  if (!context) {
    redirect(
      nextPath
        ? `${routes.portalSignIn}?next=${encodeURIComponent(nextPath)}`
        : routes.portalSignIn,
    );
  }
  return context;
}

export interface JuntoPortalContext extends PortalContext {
  membership: ActiveMembership;
}

// Denial is identical whether the Junto does not exist, is another Junto, or
// the membership was deactivated: redirect to the portal entry. Nothing
// about the requested slug's existence or contents is revealed.
export async function requireJuntoMembership(
  juntoSlug: string,
): Promise<JuntoPortalContext> {
  const context = await requirePortalUser(routes.portalJunto(juntoSlug));
  const membership = context.memberships.find(
    (candidate) => candidate.juntoSlug === juntoSlug,
  );
  if (!membership) {
    redirect(routes.portal);
  }
  return { ...context, membership };
}
