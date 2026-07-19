// Meeting data access through RLS. Private reads/writes run with the anon
// key plus the authenticated user's cookie, so Row Level Security — active
// same-Junto membership for reads, same-Junto admin membership for writes —
// is the authorization boundary. The junto_id filter always comes from the
// server-derived membership context, never from client input. Public reads
// go exclusively through the public_meetings projection, which carries no
// location, deadline, creator, or count columns at all.
import "server-only";

import { z } from "zod";

import {
  meetingFromRow,
  meetingRowSchema,
  meetingWriteErrorKey,
  publicMeetingFromRow,
  publicMeetingRowSchema,
  type Meeting,
  type MeetingInput,
  type MeetingStatus,
  type MeetingWriteErrorKey,
  type PublicMeeting,
} from "@/lib/meeting-domain";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const MEETING_COLUMNS =
  "id, meeting_date, title, theme, description, location, essay_deadline, status";

const uuidSchema = z.uuid();

export async function listJuntoMeetings(
  supabase: SupabaseServerClient,
  juntoId: string,
): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("junto_id", juntoId)
    .order("meeting_date", { ascending: false });
  if (error) {
    // Fail closed with a credential-free message.
    throw new Error(`Meeting listing failed (${error.code ?? "?"})`);
  }
  return z
    .array(meetingRowSchema)
    .parse(data ?? [])
    .map(meetingFromRow);
}

export async function getJuntoMeeting(
  supabase: SupabaseServerClient,
  juntoId: string,
  meetingId: string,
): Promise<Meeting | null> {
  // Route input: a non-UUID can never match and would only produce a noisy
  // cast error, so it resolves to the same "not found" as an absent row.
  if (!uuidSchema.safeParse(meetingId).success) {
    return null;
  }
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("id", meetingId)
    .eq("junto_id", juntoId)
    .maybeSingle();
  if (error) {
    throw new Error(`Meeting lookup failed (${error.code ?? "?"})`);
  }
  return data ? meetingFromRow(meetingRowSchema.parse(data)) : null;
}

// The next gathering: the nearest genuinely upcoming meeting from today on.
// Archived, cancelled, and completed records never qualify.
export async function getNextJuntoMeeting(
  supabase: SupabaseServerClient,
  juntoId: string,
  todayIsoDate: string,
): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("junto_id", juntoId)
    .eq("status", "upcoming")
    .gte("meeting_date", todayIsoDate)
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Next-meeting lookup failed (${error.code ?? "?"})`);
  }
  return data ? meetingFromRow(meetingRowSchema.parse(data)) : null;
}

export type MeetingWriteResult =
  { ok: true; id: string } | { ok: false; errorKey: MeetingWriteErrorKey };

export async function createJuntoMeeting(
  supabase: SupabaseServerClient,
  juntoId: string,
  input: MeetingInput,
): Promise<MeetingWriteResult> {
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      junto_id: juntoId,
      meeting_date: input.meetingDate,
      title: input.title,
      theme: input.theme,
      description: input.description,
      location: input.location,
      essay_deadline: input.essayDeadline,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      errorKey: meetingWriteErrorKey(error) ?? "request-failed",
    };
  }
  const row = z.object({ id: z.uuid() }).parse(data);
  return { ok: true, id: row.id };
}

function toUpdateResult(
  error: { code?: string | null } | null,
  rows: unknown,
): MeetingWriteResult {
  if (error) {
    return {
      ok: false,
      errorKey: meetingWriteErrorKey(error) ?? "request-failed",
    };
  }
  const parsed = z.array(z.object({ id: z.uuid() })).parse(rows ?? []);
  const first = parsed[0];
  // Zero affected rows is a denial (no such meeting in this Junto, or no
  // admin authority) — never a silent success.
  if (parsed.length !== 1 || !first) {
    return { ok: false, errorKey: "not-permitted" };
  }
  return { ok: true, id: first.id };
}

export async function updateJuntoMeeting(
  supabase: SupabaseServerClient,
  juntoId: string,
  meetingId: string,
  input: MeetingInput,
): Promise<MeetingWriteResult> {
  if (!uuidSchema.safeParse(meetingId).success) {
    return { ok: false, errorKey: "not-permitted" };
  }
  const { data, error } = await supabase
    .from("meetings")
    .update({
      meeting_date: input.meetingDate,
      title: input.title,
      theme: input.theme,
      description: input.description,
      location: input.location,
      essay_deadline: input.essayDeadline,
    })
    .eq("id", meetingId)
    .eq("junto_id", juntoId)
    .select("id");
  return toUpdateResult(error, data);
}

// Status transitions — including archive — are updates; there is no delete
// path anywhere in the application, and the database grants none.
export async function setJuntoMeetingStatus(
  supabase: SupabaseServerClient,
  juntoId: string,
  meetingId: string,
  status: MeetingStatus,
): Promise<MeetingWriteResult> {
  if (!uuidSchema.safeParse(meetingId).success) {
    return { ok: false, errorKey: "not-permitted" };
  }
  const { data, error } = await supabase
    .from("meetings")
    .update({ status })
    .eq("id", meetingId)
    .eq("junto_id", juntoId)
    .select("id");
  return toUpdateResult(error, data);
}

// ---------------------------------------------------------------------------
// Public archive reads (safe projection only)
// ---------------------------------------------------------------------------

const PUBLIC_MEETING_COLUMNS =
  "junto_slug, meeting_date, title, theme, description, status";

// Public pages serve anonymous visitors per request. When the archive
// database is unreachable they must fall back to their quiet empty state in
// bounded time — not ride out the Supabase client's full multi-second retry
// backoff on every render. The signal caps each public read (first attempt
// plus one quick retry) while normal reads stay unaffected.
const PUBLIC_READ_TIMEOUT_MS = 2_500;

function publicReadSignal(): AbortSignal {
  return AbortSignal.timeout(PUBLIC_READ_TIMEOUT_MS);
}

export async function listPublicMeetings(
  supabase: SupabaseServerClient,
  juntoSlug: string,
): Promise<PublicMeeting[]> {
  const { data, error } = await supabase
    .from("public_meetings")
    .select(PUBLIC_MEETING_COLUMNS)
    .eq("junto_slug", juntoSlug)
    .order("meeting_date", { ascending: false })
    .abortSignal(publicReadSignal());
  if (error) {
    throw new Error(`Public meeting listing failed (${error.code ?? "?"})`);
  }
  return z
    .array(publicMeetingRowSchema)
    .parse(data ?? [])
    .map(publicMeetingFromRow);
}

export async function getPublicMeetingByDate(
  supabase: SupabaseServerClient,
  juntoSlug: string,
  meetingDate: string,
): Promise<PublicMeeting | null> {
  const { data, error } = await supabase
    .from("public_meetings")
    .select(PUBLIC_MEETING_COLUMNS)
    .eq("junto_slug", juntoSlug)
    .eq("meeting_date", meetingDate)
    .abortSignal(publicReadSignal())
    .maybeSingle();
  if (error) {
    throw new Error(`Public meeting lookup failed (${error.code ?? "?"})`);
  }
  return data ? publicMeetingFromRow(publicMeetingRowSchema.parse(data)) : null;
}

const publicJuntoRowSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
});

export interface PublicJunto {
  name: string;
  slug: string;
  description: string | null;
}

// RLS already limits anon junto reads to active public chapters; the
// explicit filters state the intent and keep the query correct even for an
// authenticated viewer browsing the public archive.
export async function getPublicJunto(
  supabase: SupabaseServerClient,
  juntoSlug: string,
): Promise<PublicJunto | null> {
  const { data, error } = await supabase
    .from("juntos")
    .select("name, slug, description")
    .eq("slug", juntoSlug)
    .eq("status", "active")
    .eq("archive_visibility", "public")
    .abortSignal(publicReadSignal())
    .maybeSingle();
  if (error) {
    throw new Error(`Public junto lookup failed (${error.code ?? "?"})`);
  }
  return data ? publicJuntoRowSchema.parse(data) : null;
}
