// Pure meeting domain logic: status vocabulary, date/deadline validation,
// response schemas, grouping and next-meeting selection, labels, and safe
// error mapping. No I/O — the data access layer (src/lib/meetings.ts) and
// the server actions build on these, and unit tests exercise them directly.
import { z } from "zod";

export const MEETING_STATUSES = [
  "upcoming",
  "completed",
  "cancelled",
  "archived",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const meetingStatusSchema = z.enum(MEETING_STATUSES);

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// A real calendar date in the canonical YYYY-MM-DD form — the same shape
// Postgres emits for `date` columns and the public URL segment uses
// (docs/content/meetings.md: /juntos/san-diego/meetings/2026-06-22).
export const meetingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealCalendarDate);

// Wall-clock deadline as entered in a datetime-local control. Meetings are
// in-person; the chapter's wall time is stored and rendered as UTC so the
// round-trip is exact and independent of any server timezone.
const deadlineInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine((value) => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }
    return (
      isRealCalendarDate(String(match[1])) &&
      Number(match[2]) < 24 &&
      Number(match[3]) < 60
    );
  });

export const meetingRowSchema = z.object({
  id: z.uuid(),
  meeting_date: meetingDateSchema,
  title: z.string().nullable(),
  theme: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  essay_deadline: z.string().nullable(),
  status: meetingStatusSchema,
});

export interface Meeting {
  id: string;
  meetingDate: string;
  title: string | null;
  theme: string | null;
  description: string | null;
  location: string | null;
  essayDeadline: string | null;
  status: MeetingStatus;
}

export function meetingFromRow(row: z.infer<typeof meetingRowSchema>): Meeting {
  return {
    id: row.id,
    meetingDate: row.meeting_date,
    title: row.title,
    theme: row.theme,
    description: row.description,
    location: row.location,
    essayDeadline: row.essay_deadline,
    status: row.status,
  };
}

// Strict: a public meeting record carries ONLY the safe projection columns.
// An unexpected key (location, essay_deadline, created_by, a future count)
// is a server misconfiguration and must reject, never pass through.
export const publicMeetingRowSchema = z.strictObject({
  junto_slug: z.string(),
  meeting_date: meetingDateSchema,
  title: z.string().nullable(),
  theme: z.string().nullable(),
  description: z.string().nullable(),
  status: meetingStatusSchema,
});

export interface PublicMeeting {
  juntoSlug: string;
  meetingDate: string;
  title: string | null;
  theme: string | null;
  description: string | null;
  status: MeetingStatus;
}

export function publicMeetingFromRow(
  row: z.infer<typeof publicMeetingRowSchema>,
): PublicMeeting {
  return {
    juntoSlug: row.junto_slug,
    meetingDate: row.meeting_date,
    title: row.title,
    theme: row.theme,
    description: row.description,
    status: row.status,
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

const optionalDeadline = z
  .literal("")
  .transform(() => null)
  .or(deadlineInputSchema.transform((value) => `${value}:00+00:00`));

const meetingFormSchema = z.object({
  meetingDate: meetingDateSchema,
  title: optionalText(160),
  theme: optionalText(160),
  description: optionalText(4000),
  location: optionalText(240),
  essayDeadline: optionalDeadline,
});

export type MeetingInput = z.infer<typeof meetingFormSchema>;

export type MeetingFormErrorKey =
  "date-invalid" | "deadline-invalid" | "field-too-long";

export type ParsedMeetingForm =
  | { ok: true; input: MeetingInput }
  | { ok: false; errorKey: MeetingFormErrorKey };

// All external input is validated here at the server boundary; nothing from
// the form reaches a query unparsed.
export function parseMeetingForm(formData: FormData): ParsedMeetingForm {
  const raw = {
    meetingDate: String(formData.get("meeting-date") ?? ""),
    title: String(formData.get("title") ?? ""),
    theme: String(formData.get("theme") ?? ""),
    description: String(formData.get("description") ?? ""),
    location: String(formData.get("location") ?? ""),
    essayDeadline: String(formData.get("essay-deadline") ?? ""),
  };
  const result = meetingFormSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, input: result.data };
  }
  const field = result.error.issues[0]?.path[0];
  const errorKey: MeetingFormErrorKey =
    field === "meetingDate"
      ? "date-invalid"
      : field === "essayDeadline"
        ? "deadline-invalid"
        : "field-too-long";
  return { ok: false, errorKey };
}

// ---------------------------------------------------------------------------
// Grouping, selection, and presentation
// ---------------------------------------------------------------------------

export interface MeetingGroups {
  upcoming: Meeting[];
  history: Meeting[];
}

function byDateAscending(a: Meeting, b: Meeting): number {
  return a.meetingDate.localeCompare(b.meetingDate);
}

// A meeting belongs to the upcoming program only while its status is
// genuinely `upcoming` and its date has not passed. Everything else —
// completed, cancelled, archived, or a stale never-updated record — is
// history, labeled honestly (docs/content/meetings.md, "Deleting meetings").
export function groupMeetings(
  meetings: Meeting[],
  todayIsoDate: string,
): MeetingGroups {
  const upcoming = meetings
    .filter(
      (meeting) =>
        meeting.status === "upcoming" && meeting.meetingDate >= todayIsoDate,
    )
    .sort(byDateAscending);
  const history = meetings
    .filter((meeting) => !upcoming.includes(meeting))
    .sort((a, b) => byDateAscending(b, a));
  return { upcoming, history };
}

export function selectNextMeeting(
  meetings: Meeting[],
  todayIsoDate: string,
): Meeting | null {
  return groupMeetings(meetings, todayIsoDate).upcoming[0] ?? null;
}

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<MeetingStatus, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

export function meetingStatusLabel(status: MeetingStatus): string {
  return STATUS_LABELS[status];
}

// A meeting is identified first by its date; the title or theme names the
// evening when one exists.
export function meetingDisplayName(meeting: {
  title: string | null;
  theme: string | null;
}): string | null {
  return meeting.title ?? meeting.theme;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatMeetingDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

const DEADLINE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatEssayDeadline(iso: string): string {
  return DEADLINE_FORMAT.format(new Date(iso));
}

// Prefills a datetime-local control from a stored deadline (exact inverse of
// the optionalDeadline transform).
export function essayDeadlineInputValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return new Date(iso).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Safe error mapping
// ---------------------------------------------------------------------------

export type MeetingWriteErrorKey =
  "date-taken" | "not-permitted" | "request-failed";

// Maps a PostgREST error to a safe, credential-free key: 23505 is the
// documented per-Junto date uniqueness, 42501 is an authorization denial,
// and everything else is a generic failure that reveals nothing.
export function meetingWriteErrorKey(
  error: { code?: string | null } | null,
): MeetingWriteErrorKey | null {
  if (!error) {
    return null;
  }
  if (error.code === "23505") {
    return "date-taken";
  }
  if (error.code === "42501") {
    return "not-permitted";
  }
  return "request-failed";
}
