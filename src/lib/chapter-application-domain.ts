import { z } from "zod";

export const CHAPTER_APPLICATION_REVIEWER_EMAIL = "txpinella@gmail.com";

const chapterNameSchema = z.string().trim().min(1).max(120);
const locationSchema = z.string().trim().min(1).max(240);
const applicantEmailSchema = z.string().trim().max(254).pipe(z.email());
const intentNoteSchema = z.string().trim().min(1).max(1000);
const honeypotSchema = z.string().max(200);
const applicationIdSchema = z.uuid();
const chapterSlugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => slug !== "sign-in" && slug !== "applications");

export interface ChapterApplicationInput {
  chapterName: string;
  location: string;
  applicantEmail: string;
  intentNote: string;
  website: string;
}

export type ChapterApplicationFormErrorKey =
  | "name-invalid"
  | "location-invalid"
  | "email-invalid"
  | "note-invalid"
  | "request-invalid";

export type ChapterApplicationFormResult =
  | { ok: true; input: ChapterApplicationInput }
  | { ok: false; errorKey: ChapterApplicationFormErrorKey };

function textField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export function parseChapterApplicationForm(
  formData: FormData,
): ChapterApplicationFormResult {
  const chapterName = chapterNameSchema.safeParse(
    textField(formData, "chapter-name"),
  );
  if (!chapterName.success) return { ok: false, errorKey: "name-invalid" };

  const location = locationSchema.safeParse(textField(formData, "location"));
  if (!location.success) {
    return { ok: false, errorKey: "location-invalid" };
  }

  const applicantEmail = applicantEmailSchema.safeParse(
    textField(formData, "email"),
  );
  if (!applicantEmail.success) {
    return { ok: false, errorKey: "email-invalid" };
  }

  const intentNote = intentNoteSchema.safeParse(
    textField(formData, "intent-note"),
  );
  if (!intentNote.success) {
    return { ok: false, errorKey: "note-invalid" };
  }

  const website = honeypotSchema.safeParse(
    textField(formData, "website") ?? "",
  );
  if (!website.success) {
    return { ok: false, errorKey: "request-invalid" };
  }

  return {
    ok: true,
    input: {
      chapterName: chapterName.data,
      location: location.data,
      applicantEmail: applicantEmail.data.toLowerCase(),
      intentNote: intentNote.data,
      website: website.data,
    },
  };
}

export function deriveChapterSlug(name: string): string {
  const derived = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return chapterSlugSchema.safeParse(derived).success ? derived : "chapter";
}

export type ApplicationDecisionInput =
  | { applicationId: string; decision: "approve"; chapterSlug: string }
  | { applicationId: string; decision: "decline"; chapterSlug: null };

export type ApplicationDecisionFormResult =
  | { ok: true; input: ApplicationDecisionInput }
  | {
      ok: false;
      errorKey: "application-invalid" | "slug-invalid";
    };

export function parseApplicationDecisionForm(
  formData: FormData,
  decision: "approve" | "decline",
): ApplicationDecisionFormResult {
  const applicationId = applicationIdSchema.safeParse(
    textField(formData, "application-id"),
  );
  if (!applicationId.success) {
    return { ok: false, errorKey: "application-invalid" };
  }
  if (decision === "decline") {
    return {
      ok: true,
      input: { applicationId: applicationId.data, decision, chapterSlug: null },
    };
  }
  const chapterSlug = chapterSlugSchema.safeParse(
    textField(formData, "chapter-slug"),
  );
  if (!chapterSlug.success) {
    return { ok: false, errorKey: "slug-invalid" };
  }
  return {
    ok: true,
    input: {
      applicationId: applicationId.data,
      decision,
      chapterSlug: chapterSlug.data,
    },
  };
}

export function isVerifiedApplicationReviewer(user: {
  email?: string | null;
  email_confirmed_at?: string | null;
}): boolean {
  return (
    user.email_confirmed_at != null &&
    user.email?.trim().toLowerCase() === CHAPTER_APPLICATION_REVIEWER_EMAIL
  );
}

export type ChapterApplicationWriteErrorKey =
  "not-permitted" | "input-invalid" | "slug-taken" | "request-failed";

export function chapterApplicationWriteErrorKey(error: {
  code?: string | null;
}): ChapterApplicationWriteErrorKey {
  if (error.code === "42501") return "not-permitted";
  if (error.code === "22023" || error.code === "23514") {
    return "input-invalid";
  }
  if (error.code === "23505") return "slug-taken";
  return "request-failed";
}
