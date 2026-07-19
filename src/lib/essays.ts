// Essay data access through RLS. Private reads/writes run with the anon key
// plus the authenticated user's cookie, so Row Level Security — active
// same-Junto membership for published reads, author/admin for drafts — is
// the authorization boundary. The junto_id filter always comes from the
// server-derived membership context, never from client input; author
// identity derives from auth.uid() inside the database. Publication state
// changes go exclusively through the transition_essay RPC, and public reads
// go exclusively through the public_essays projection, which carries no id,
// status/visibility, email, location, or membership columns at all.
import "server-only";

import { z } from "zod";

import {
  deriveEssaySlug,
  essayFromRow,
  essayRowSchema,
  essaySlugSchema,
  essayStatusSchema,
  essayVisibilitySchema,
  essayWriteErrorKey,
  publicEssayFromRow,
  publicEssayRowSchema,
  type Essay,
  type EssayDraftInput,
  type EssayPublicationState,
  type EssayWriteErrorKey,
  type PublicEssay,
} from "@/lib/essay-domain";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const ESSAY_COLUMNS =
  "id, author_id, meeting_id, title, slug, subtitle, body_markdown, " +
  "status, visibility, published_at, created_at, updated_at";

const uuidSchema = z.uuid();

// ---------------------------------------------------------------------------
// Junto-scoped private reads (author dashboard and member reading)
// ---------------------------------------------------------------------------

// The signed-in member's own essays — drafts and published — in one Junto.
// The author id is the authenticated user's, passed from the server-derived
// portal context.
export async function listOwnEssays(
  supabase: SupabaseServerClient,
  juntoId: string,
  authorId: string,
): Promise<Essay[]> {
  const { data, error } = await supabase
    .from("essays")
    .select(ESSAY_COLUMNS)
    .eq("junto_id", juntoId)
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });
  if (error) {
    // Fail closed with a credential-free message.
    throw new Error(`Essay listing failed (${error.code ?? "?"})`);
  }
  return z
    .array(essayRowSchema)
    .parse(data ?? [])
    .map(essayFromRow);
}

// Published essays of one Junto (either visibility) for authenticated
// member surfaces. RLS enforces the active same-Junto membership.
export async function listPublishedJuntoEssays(
  supabase: SupabaseServerClient,
  juntoId: string,
): Promise<Essay[]> {
  const { data, error } = await supabase
    .from("essays")
    .select(ESSAY_COLUMNS)
    .eq("junto_id", juntoId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) {
    throw new Error(`Published essay listing failed (${error.code ?? "?"})`);
  }
  return z
    .array(essayRowSchema)
    .parse(data ?? [])
    .map(essayFromRow);
}

export async function getJuntoEssay(
  supabase: SupabaseServerClient,
  juntoId: string,
  essayId: string,
): Promise<Essay | null> {
  // Route input: a non-UUID can never match and would only produce a noisy
  // cast error, so it resolves to the same "not found" as an absent row.
  if (!uuidSchema.safeParse(essayId).success) {
    return null;
  }
  const { data, error } = await supabase
    .from("essays")
    .select(ESSAY_COLUMNS)
    .eq("id", essayId)
    .eq("junto_id", juntoId)
    .maybeSingle();
  if (error) {
    throw new Error(`Essay lookup failed (${error.code ?? "?"})`);
  }
  return data ? essayFromRow(essayRowSchema.parse(data)) : null;
}

// Author-workspace lookup. The author filter is part of the query rather
// than a presentation-layer check, so another author's row is the same
// uniform miss as an absent or cross-Junto id even for a Junto admin.
export async function getOwnJuntoEssay(
  supabase: SupabaseServerClient,
  juntoId: string,
  authorId: string,
  essayId: string,
): Promise<Essay | null> {
  if (!uuidSchema.safeParse(essayId).success) {
    return null;
  }
  const { data, error } = await supabase
    .from("essays")
    .select(ESSAY_COLUMNS)
    .eq("id", essayId)
    .eq("junto_id", juntoId)
    .eq("author_id", authorId)
    .maybeSingle();
  if (error) {
    throw new Error(`Essay lookup failed (${error.code ?? "?"})`);
  }
  return data ? essayFromRow(essayRowSchema.parse(data)) : null;
}

// ---------------------------------------------------------------------------
// Draft creation and content updates
// ---------------------------------------------------------------------------

export type EssayCreateResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; errorKey: EssayWriteErrorKey };

// Bounded collision retries: deterministic ordinals against the global
// unique constraint, never client-supplied identity.
const MAX_SLUG_ATTEMPTS = 25;

export async function createEssayDraft(
  supabase: SupabaseServerClient,
  juntoId: string,
  input: EssayDraftInput,
): Promise<EssayCreateResult> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = deriveEssaySlug(input.title, attempt);
    const { data, error } = await supabase
      .from("essays")
      .insert({
        junto_id: juntoId,
        meeting_id: input.meetingId,
        title: input.title,
        slug,
        subtitle: input.subtitle,
        body_markdown: input.bodyMarkdown,
      })
      .select("id, slug")
      .single();
    if (!error) {
      const row = z.object({ id: z.uuid(), slug: essaySlugSchema }).parse(data);
      return { ok: true, id: row.id, slug: row.slug };
    }
    const errorKey = essayWriteErrorKey(error) ?? "request-failed";
    if (errorKey !== "slug-taken") {
      return { ok: false, errorKey };
    }
  }
  return { ok: false, errorKey: "slug-taken" };
}

export type EssayWriteResult =
  { ok: true; id: string } | { ok: false; errorKey: EssayWriteErrorKey };

// Content-only update: title, subtitle, body, and meeting assignment. The
// slug and all publication state stay untouched by design (and the database
// grants no way around that). RLS returns zero rows for anything the caller
// may not edit — which is a denial, never a silent success.
export async function updateEssayContent(
  supabase: SupabaseServerClient,
  juntoId: string,
  essayId: string,
  input: EssayDraftInput,
): Promise<EssayWriteResult> {
  if (!uuidSchema.safeParse(essayId).success) {
    return { ok: false, errorKey: "not-permitted" };
  }
  const { data, error } = await supabase
    .from("essays")
    .update({
      title: input.title,
      subtitle: input.subtitle,
      body_markdown: input.bodyMarkdown,
      meeting_id: input.meetingId,
    })
    .eq("id", essayId)
    .eq("junto_id", juntoId)
    .select("id");
  if (error) {
    return {
      ok: false,
      errorKey: essayWriteErrorKey(error) ?? "request-failed",
    };
  }
  const parsed = z.array(z.object({ id: z.uuid() })).parse(data ?? []);
  const first = parsed[0];
  if (parsed.length !== 1 || !first) {
    return { ok: false, errorKey: "not-permitted" };
  }
  return { ok: true, id: first.id };
}

// ---------------------------------------------------------------------------
// Publication transitions
// ---------------------------------------------------------------------------

const transitionRowSchema = z.object({
  id: z.uuid(),
  status: essayStatusSchema,
  visibility: essayVisibilitySchema,
  published_at: z.string().nullable(),
});

export type EssayTransitionResult =
  | {
      ok: true;
      state: EssayPublicationState;
      publishedAt: string | null;
    }
  | { ok: false; errorKey: EssayWriteErrorKey };

// The only publication path: the database function rederives the caller's
// identity and authority, enforces the explicit public-exposure
// confirmation, and keeps the publication timestamp coherent. Errors map to
// safe keys; nothing else about the essay is disclosed.
export async function transitionEssay(
  supabase: SupabaseServerClient,
  essayId: string,
  target: EssayPublicationState,
  confirmPublicExposure = false,
): Promise<EssayTransitionResult> {
  if (!uuidSchema.safeParse(essayId).success) {
    return { ok: false, errorKey: "not-permitted" };
  }
  const { data, error } = await supabase.rpc("transition_essay", {
    target_essay_id: essayId,
    new_status: target.status,
    new_visibility: target.visibility,
    confirm_public_exposure: confirmPublicExposure,
  });
  if (error) {
    return {
      ok: false,
      errorKey: essayWriteErrorKey(error) ?? "request-failed",
    };
  }
  const rows = z.array(transitionRowSchema).parse(data ?? []);
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    return { ok: false, errorKey: "request-failed" };
  }
  return {
    ok: true,
    state: { status: row.status, visibility: row.visibility },
    publishedAt: row.published_at,
  };
}

// ---------------------------------------------------------------------------
// Public archive reads (safe projection only)
// ---------------------------------------------------------------------------

const PUBLIC_ESSAY_COLUMNS =
  "slug, title, subtitle, body_markdown, published_at, author_name, " +
  "author_slug, junto_name, junto_slug, meeting_date, meeting_title";

// Public pages serve anonymous visitors per request. When the archive
// database is unreachable they must fall back to their quiet empty state in
// bounded time — not ride out the Supabase client's full multi-second retry
// backoff on every render. The signal caps each public read (first attempt
// plus one quick retry) while private reads stay unaffected.
const PUBLIC_READ_TIMEOUT_MS = 2_500;

function publicReadSignal(): AbortSignal {
  return AbortSignal.timeout(PUBLIC_READ_TIMEOUT_MS);
}

export async function listPublicEssays(
  supabase: SupabaseServerClient,
): Promise<PublicEssay[]> {
  const { data, error } = await supabase
    .from("public_essays")
    .select(PUBLIC_ESSAY_COLUMNS)
    .order("published_at", { ascending: false })
    .abortSignal(publicReadSignal());
  if (error) {
    throw new Error(`Public essay listing failed (${error.code ?? "?"})`);
  }
  return z
    .array(publicEssayRowSchema)
    .parse(data ?? [])
    .map(publicEssayFromRow);
}

export async function getPublicEssayBySlug(
  supabase: SupabaseServerClient,
  essaySlug: string,
): Promise<PublicEssay | null> {
  // URL input: a malformed slug can never match, so it resolves to the same
  // uniform miss as an absent, private, unpublished, or ineligible essay —
  // without ever reaching the database.
  if (!essaySlugSchema.safeParse(essaySlug).success) {
    return null;
  }
  const { data, error } = await supabase
    .from("public_essays")
    .select(PUBLIC_ESSAY_COLUMNS)
    .eq("slug", essaySlug)
    .abortSignal(publicReadSignal())
    .maybeSingle();
  if (error) {
    throw new Error(`Public essay lookup failed (${error.code ?? "?"})`);
  }
  return data ? publicEssayFromRow(publicEssayRowSchema.parse(data)) : null;
}
