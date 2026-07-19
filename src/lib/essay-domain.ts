// Pure essay domain logic: status/visibility vocabulary, slug derivation,
// input validation, response schemas, transition confirmation, labels, and
// safe error mapping. No I/O — the data access layer (src/lib/essays.ts) and
// later T06 server actions build on these, and unit tests exercise them
// directly.
import { z } from "zod";

import { meetingDateSchema } from "@/lib/meeting-domain";

export const ESSAY_STATUSES = ["draft", "published"] as const;
export type EssayStatus = (typeof ESSAY_STATUSES)[number];
export const essayStatusSchema = z.enum(ESSAY_STATUSES);

export const ESSAY_VISIBILITIES = ["public", "members_only"] as const;
export type EssayVisibility = (typeof ESSAY_VISIBILITIES)[number];
export const essayVisibilitySchema = z.enum(ESSAY_VISIBILITIES);

// Mirrors the database slug constraint exactly: lowercase, URL-safe, no
// leading/trailing/double hyphens.
export const essaySlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const SLUG_MAX_LENGTH = 80;

// Deterministic application-side slug derivation (docs/content/essays.md
// §6.7): the slug is fixed at creation from the title and never rewritten —
// collision handling appends a deterministic ordinal at the unique
// constraint (see createEssayDraft). Diacritics fold to ASCII; anything else
// non-alphanumeric collapses to single hyphens.
export function deriveEssaySlug(title: string, attempt = 0): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
  const stem = base === "" ? "essay" : base;
  return attempt === 0 ? stem : `${stem}-${attempt + 1}`;
}

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const essayRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  meeting_id: z.uuid().nullable(),
  title: z.string(),
  slug: essaySlugSchema,
  subtitle: z.string().nullable(),
  body_markdown: z.string(),
  status: essayStatusSchema,
  visibility: essayVisibilitySchema,
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export interface Essay {
  id: string;
  authorId: string;
  meetingId: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  bodyMarkdown: string;
  status: EssayStatus;
  visibility: EssayVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function essayFromRow(row: z.infer<typeof essayRowSchema>): Essay {
  return {
    id: row.id,
    authorId: row.author_id,
    meetingId: row.meeting_id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    bodyMarkdown: row.body_markdown,
    status: row.status,
    visibility: row.visibility,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Strict: a public essay record carries ONLY the safe projection columns.
// An unexpected key (an id, status/visibility machinery, an email, a
// location, a count) is a server misconfiguration and must reject, never
// pass through to a public page.
export const publicEssayRowSchema = z.strictObject({
  slug: essaySlugSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  body_markdown: z.string(),
  published_at: z.string(),
  author_name: z.string(),
  author_slug: z.string(),
  junto_name: z.string(),
  junto_slug: z.string(),
  meeting_date: meetingDateSchema.nullable(),
  meeting_title: z.string().nullable(),
});

export interface PublicEssay {
  slug: string;
  title: string;
  subtitle: string | null;
  bodyMarkdown: string;
  publishedAt: string;
  authorName: string;
  authorSlug: string;
  juntoName: string;
  juntoSlug: string;
  meetingDate: string | null;
  meetingTitle: string | null;
}

export function publicEssayFromRow(
  row: z.infer<typeof publicEssayRowSchema>,
): PublicEssay {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    bodyMarkdown: row.body_markdown,
    publishedAt: row.published_at,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    juntoName: row.junto_name,
    juntoSlug: row.junto_slug,
    meetingDate: row.meeting_date,
    meetingTitle: row.meeting_title,
  };
}

// ---------------------------------------------------------------------------
// Form input validation
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const essayDraftFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: optionalText(300),
  bodyMarkdown: z.string().max(100_000),
  meetingId: z
    .literal("")
    .transform(() => null)
    .or(z.uuid()),
});

export type EssayDraftInput = z.infer<typeof essayDraftFormSchema>;

export type EssayFormErrorKey =
  | "title-required"
  | "field-too-long"
  | "meeting-invalid"
  | "visibility-invalid";

export type ParsedEssayDraftForm =
  | { ok: true; input: EssayDraftInput }
  | { ok: false; errorKey: EssayFormErrorKey };

// All external input is validated here at the server boundary; nothing from
// a form reaches a query unparsed. The meeting id is routing input only —
// the database's composite foreign key remains the integrity boundary.
export function parseEssayDraftForm(formData: FormData): ParsedEssayDraftForm {
  const raw = {
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    bodyMarkdown: String(formData.get("body-markdown") ?? ""),
    meetingId: String(formData.get("meeting-id") ?? ""),
  };
  const result = essayDraftFormSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, input: result.data };
  }
  const issue = result.error.issues[0];
  const field = issue?.path[0];
  const errorKey: EssayFormErrorKey =
    field === "meetingId"
      ? "meeting-invalid"
      : field === "title" && issue?.code === "too_small"
        ? "title-required"
        : "field-too-long";
  return { ok: false, errorKey };
}

export interface EssayWorkspaceInput {
  draft: EssayDraftInput;
  visibility: EssayVisibility;
}

export type ParsedEssayWorkspaceForm =
  | { ok: true; input: EssayWorkspaceInput }
  | { ok: false; errorKey: EssayFormErrorKey };

// The workspace keeps visibility explicit while leaving the lower-level
// draft seam focused on content. Missing or invented visibility values fail
// closed at the action boundary.
export function parseEssayWorkspaceForm(
  formData: FormData,
): ParsedEssayWorkspaceForm {
  const draft = parseEssayDraftForm(formData);
  if (!draft.ok) {
    return draft;
  }
  const visibility = essayVisibilitySchema.safeParse(
    formData.get("visibility"),
  );
  if (!visibility.success) {
    return { ok: false, errorKey: "visibility-invalid" };
  }
  return {
    ok: true,
    input: { draft: draft.input, visibility: visibility.data },
  };
}

// Native checkboxes submit their value only when checked. Literal `on` is
// the sole UI proof of confirmation; omitted, false-like, or forged values
// all become false before reaching transitionEssay.
export function hasExplicitPublicExposureConfirmation(
  formData: FormData,
): boolean {
  return formData.get("confirm-public-exposure") === "on";
}

// ---------------------------------------------------------------------------
// Publication transitions
// ---------------------------------------------------------------------------

export interface EssayPublicationState {
  status: EssayStatus;
  visibility: EssayVisibility;
}

// Explicit confirmation is required exactly when a transition would make an
// essay internet-visible while it is not already (docs/content/essays.md
// §6.6). Withdrawing visibility never needs confirmation.
export function needsPublicExposureConfirmation(
  current: EssayPublicationState,
  target: EssayPublicationState,
): boolean {
  const targetIsPublic =
    target.status === "published" && target.visibility === "public";
  const alreadyPublic =
    current.status === "published" && current.visibility === "public";
  return targetIsPublic && !alreadyPublic;
}

// ---------------------------------------------------------------------------
// Presentation labels
// ---------------------------------------------------------------------------

const VISIBILITY_LABELS: Record<EssayVisibility, string> = {
  public: "Public",
  // Explicit privacy language, never merely "Private"
  // (docs/content/essays.md §6.5).
  members_only: "Junto members only",
};

export function essayVisibilityLabel(visibility: EssayVisibility): string {
  return VISIBILITY_LABELS[visibility];
}

const STATUS_LABELS: Record<EssayStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export function essayStatusLabel(status: EssayStatus): string {
  return STATUS_LABELS[status];
}

// ---------------------------------------------------------------------------
// Safe error mapping
// ---------------------------------------------------------------------------

export type EssayWriteErrorKey =
  | "slug-taken"
  | "not-permitted"
  | "meeting-invalid"
  | "essay-incomplete"
  | "confirmation-required"
  | "invalid-transition"
  | "request-failed";

// Maps a PostgREST error to a safe, credential-free key: 23505 is the global
// slug uniqueness, 23503 the same-Junto meeting integrity, 23514 the
// publication completeness checks, 42501 an authorization denial, 22023 an
// invalid transition input, and the transition function's own
// confirmation-required signal arrives as P0001 with a fixed message.
// Everything else collapses to a generic failure that reveals nothing.
export function essayWriteErrorKey(
  error: { code?: string | null; message?: string | null } | null,
): EssayWriteErrorKey | null {
  if (!error) {
    return null;
  }
  switch (error.code) {
    case "23505":
      return "slug-taken";
    case "23503":
      return "meeting-invalid";
    case "23514":
      return "essay-incomplete";
    case "42501":
      return "not-permitted";
    case "22023":
      return "invalid-transition";
    case "P0001":
      return error.message === "confirmation-required"
        ? "confirmation-required"
        : "request-failed";
    default:
      return "request-failed";
  }
}
