import { z } from "zod";

export const archiveVisibilitySchema = z.enum(["private", "public"]);

const nameSchema = z.string().trim().min(1).max(120);
const slugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  // `/portal/sign-in` is static; see docs/architecture/data-model.md,
  // "Atomic Junto bootstrap."
  .refine((slug) => slug !== "sign-in");
const descriptionSchema = z.string().trim().max(2000);
const locationSchema = z.string().trim().max(240);

export interface ChapterInput {
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  archiveVisibility: z.infer<typeof archiveVisibilitySchema>;
}

export type ChapterFormErrorKey =
  | "name-invalid"
  | "slug-invalid"
  | "description-invalid"
  | "location-invalid"
  | "visibility-invalid";

export type ChapterFormResult =
  | { ok: true; input: ChapterInput }
  | { ok: false; errorKey: ChapterFormErrorKey };

export interface ChapterSettingsInput {
  name: string;
  description: string | null;
  location: string | null;
  archiveVisibility: z.infer<typeof archiveVisibilitySchema>;
}

export type ChapterSettingsFormResult =
  | { ok: true; input: ChapterSettingsInput }
  | { ok: false; errorKey: Exclude<ChapterFormErrorKey, "slug-invalid"> };

function optionalText(
  formData: FormData,
  field: string,
  schema: typeof descriptionSchema | typeof locationSchema,
): string | null | undefined {
  const value = formData.get(field);
  if (value !== null && typeof value !== "string") return undefined;
  const parsed = schema.safeParse(value ?? "");
  if (!parsed.success) return undefined;
  return parsed.data === "" ? null : parsed.data;
}

function parseVisibility(
  value: FormDataEntryValue | null,
  defaultPrivate: boolean,
): z.infer<typeof archiveVisibilitySchema> | undefined {
  if (value === null && defaultPrivate) return "private";
  const parsed = archiveVisibilitySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseChapterForm(formData: FormData): ChapterFormResult {
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) return { ok: false, errorKey: "name-invalid" };

  const slug = slugSchema.safeParse(formData.get("slug") ?? "");
  if (!slug.success) return { ok: false, errorKey: "slug-invalid" };

  const description = optionalText(formData, "description", descriptionSchema);
  if (description === undefined) {
    return { ok: false, errorKey: "description-invalid" };
  }

  const location = optionalText(formData, "location", locationSchema);
  if (location === undefined) {
    return { ok: false, errorKey: "location-invalid" };
  }

  const archiveVisibility = parseVisibility(
    formData.get("archive-visibility"),
    true,
  );
  if (!archiveVisibility) {
    return { ok: false, errorKey: "visibility-invalid" };
  }

  return {
    ok: true,
    input: {
      name: name.data,
      slug: slug.data,
      description,
      location,
      archiveVisibility,
    },
  };
}

export function parseChapterSettingsForm(
  formData: FormData,
): ChapterSettingsFormResult {
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) return { ok: false, errorKey: "name-invalid" };

  const description = optionalText(formData, "description", descriptionSchema);
  if (description === undefined) {
    return { ok: false, errorKey: "description-invalid" };
  }

  const location = optionalText(formData, "location", locationSchema);
  if (location === undefined) {
    return { ok: false, errorKey: "location-invalid" };
  }

  const archiveVisibility = parseVisibility(
    formData.get("archive-visibility"),
    false,
  );
  if (!archiveVisibility) {
    return { ok: false, errorKey: "visibility-invalid" };
  }

  return {
    ok: true,
    input: { name: name.data, description, location, archiveVisibility },
  };
}

export type ChapterWriteErrorKey =
  "slug-taken" | "not-permitted" | "input-invalid" | "request-failed";

export function chapterWriteErrorKey(error: {
  code?: string | null;
}): ChapterWriteErrorKey {
  if (error.code === "23505") return "slug-taken";
  if (error.code === "42501") return "not-permitted";
  if (error.code === "22023" || error.code === "23514") {
    return "input-invalid";
  }
  return "request-failed";
}
