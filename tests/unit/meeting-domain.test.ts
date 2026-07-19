import { describe, expect, it } from "vitest";

import {
  essayDeadlineInputValue,
  formatEssayDeadline,
  formatMeetingDate,
  groupMeetings,
  meetingDateSchema,
  meetingDisplayName,
  meetingRowSchema,
  meetingStatusLabel,
  meetingWriteErrorKey,
  parseMeetingForm,
  publicMeetingRowSchema,
  selectNextMeeting,
  todayIsoDate,
  type Meeting,
} from "@/lib/meeting-domain";

function makeMeeting(
  overrides: Partial<Meeting> & Pick<Meeting, "id">,
): Meeting {
  return {
    meetingDate: "2026-06-22",
    title: null,
    theme: null,
    description: null,
    location: null,
    essayDeadline: null,
    status: "upcoming",
    ...overrides,
  };
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("meetingDateSchema", () => {
  it("accepts canonical calendar dates", () => {
    expect(meetingDateSchema.safeParse("2026-06-22").success).toBe(true);
    expect(meetingDateSchema.safeParse("2024-02-29").success).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    for (const value of [
      "2026-6-2",
      "22-06-2026",
      "2026-13-01",
      "2026-00-10",
      "2026-02-30",
      "2025-02-29",
      "2026-06-22T00:00:00Z",
      "not-a-date",
      "",
    ]) {
      expect(meetingDateSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("parseMeetingForm", () => {
  it("accepts a complete valid form and trims optional fields", () => {
    const parsed = parseMeetingForm(
      form({
        "meeting-date": "2026-06-22",
        title: "  What do we owe the future?  ",
        theme: "Obligation",
        description: "Essays on duty across time.",
        location: "Thomas's apartment",
        "essay-deadline": "2026-06-20T18:00",
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      input: {
        meetingDate: "2026-06-22",
        title: "What do we owe the future?",
        theme: "Obligation",
        description: "Essays on duty across time.",
        location: "Thomas's apartment",
        essayDeadline: "2026-06-20T18:00:00+00:00",
      },
    });
  });

  it("turns empty optional fields into explicit nulls", () => {
    const parsed = parseMeetingForm(form({ "meeting-date": "2026-06-22" }));
    expect(parsed).toEqual({
      ok: true,
      input: {
        meetingDate: "2026-06-22",
        title: null,
        theme: null,
        description: null,
        location: null,
        essayDeadline: null,
      },
    });
  });

  it("rejects an invalid meeting date with a safe key", () => {
    expect(parseMeetingForm(form({ "meeting-date": "2026-02-30" }))).toEqual({
      ok: false,
      errorKey: "date-invalid",
    });
    expect(parseMeetingForm(form({}))).toEqual({
      ok: false,
      errorKey: "date-invalid",
    });
  });

  it("rejects an invalid essay deadline with a safe key", () => {
    for (const value of [
      "2026-06-20",
      "2026-06-20T25:00",
      "2026-02-30T18:00",
      "18:00",
      "later",
    ]) {
      expect(
        parseMeetingForm(
          form({ "meeting-date": "2026-06-22", "essay-deadline": value }),
        ),
      ).toEqual({ ok: false, errorKey: "deadline-invalid" });
    }
  });

  it("rejects oversized fields with a safe key", () => {
    expect(
      parseMeetingForm(
        form({ "meeting-date": "2026-06-22", title: "x".repeat(161) }),
      ),
    ).toEqual({ ok: false, errorKey: "field-too-long" });
  });
});

describe("grouping and next-meeting selection", () => {
  const today = "2026-06-01";
  const upcomingSoon = makeMeeting({
    id: "00000000-0000-4000-a000-000000000001",
    meetingDate: "2026-06-22",
  });
  const upcomingLater = makeMeeting({
    id: "00000000-0000-4000-a000-000000000002",
    meetingDate: "2026-07-20",
  });
  const upcomingToday = makeMeeting({
    id: "00000000-0000-4000-a000-000000000003",
    meetingDate: "2026-06-01",
  });
  const staleUpcoming = makeMeeting({
    id: "00000000-0000-4000-a000-000000000004",
    meetingDate: "2026-05-01",
  });
  const cancelledFuture = makeMeeting({
    id: "00000000-0000-4000-a000-000000000005",
    meetingDate: "2026-06-10",
    status: "cancelled",
  });
  const completedPast = makeMeeting({
    id: "00000000-0000-4000-a000-000000000006",
    meetingDate: "2026-04-01",
    status: "completed",
  });
  const archivedFuture = makeMeeting({
    id: "00000000-0000-4000-a000-000000000007",
    meetingDate: "2026-06-15",
    status: "archived",
  });
  const all = [
    completedPast,
    upcomingLater,
    archivedFuture,
    staleUpcoming,
    upcomingSoon,
    cancelledFuture,
    upcomingToday,
  ];

  it("keeps only genuinely upcoming meetings in the upcoming program", () => {
    const groups = groupMeetings(all, today);
    expect(groups.upcoming.map((m) => m.id)).toEqual([
      upcomingToday.id,
      upcomingSoon.id,
      upcomingLater.id,
    ]);
  });

  it("sends every other record to history, newest first", () => {
    const groups = groupMeetings(all, today);
    expect(groups.history.map((m) => m.id)).toEqual([
      archivedFuture.id,
      cancelledFuture.id,
      staleUpcoming.id,
      completedPast.id,
    ]);
  });

  it("selects today's or the nearest future upcoming meeting as next", () => {
    expect(selectNextMeeting(all, today)?.id).toBe(upcomingToday.id);
    expect(selectNextMeeting(all, "2026-06-02")?.id).toBe(upcomingSoon.id);
  });

  it("never selects cancelled, completed, or archived meetings as next", () => {
    expect(
      selectNextMeeting(
        [cancelledFuture, archivedFuture, completedPast],
        today,
      ),
    ).toBeNull();
  });

  it("returns null when nothing is upcoming", () => {
    expect(selectNextMeeting([], today)).toBeNull();
    expect(selectNextMeeting([staleUpcoming], today)).toBeNull();
  });
});

describe("presentation helpers", () => {
  it("labels every status honestly", () => {
    expect(meetingStatusLabel("upcoming")).toBe("Upcoming");
    expect(meetingStatusLabel("completed")).toBe("Completed");
    expect(meetingStatusLabel("cancelled")).toBe("Cancelled");
    expect(meetingStatusLabel("archived")).toBe("Archived");
  });

  it("names a meeting by title first, then theme, then nothing", () => {
    expect(meetingDisplayName({ title: "A title", theme: "A theme" })).toBe(
      "A title",
    );
    expect(meetingDisplayName({ title: null, theme: "A theme" })).toBe(
      "A theme",
    );
    expect(meetingDisplayName({ title: null, theme: null })).toBeNull();
  });

  it("formats dates and deadlines deterministically in UTC", () => {
    expect(formatMeetingDate("2026-06-22")).toBe("June 22, 2026");
    expect(formatEssayDeadline("2026-06-20T18:00:00+00:00")).toBe(
      "June 20, 2026 at 6:00 PM",
    );
  });

  it("round-trips a stored deadline into the datetime-local control", () => {
    expect(essayDeadlineInputValue("2026-06-20T18:00:00+00:00")).toBe(
      "2026-06-20T18:00",
    );
    expect(essayDeadlineInputValue(null)).toBe("");
  });

  it("derives today's ISO date in UTC", () => {
    expect(todayIsoDate(new Date("2026-06-22T23:59:00Z"))).toBe("2026-06-22");
    expect(todayIsoDate(new Date("2026-06-22T00:00:01Z"))).toBe("2026-06-22");
  });
});

describe("response schemas", () => {
  it("accepts a full private meeting row", () => {
    expect(
      meetingRowSchema.safeParse({
        id: "00000000-0000-4000-a000-000000000001",
        meeting_date: "2026-06-22",
        title: null,
        theme: null,
        description: null,
        location: "Thomas's apartment",
        essay_deadline: "2026-06-20T18:00:00+00:00",
        status: "upcoming",
      }).success,
    ).toBe(true);
  });

  it("rejects rows with an unknown status", () => {
    expect(
      meetingRowSchema.safeParse({
        id: "00000000-0000-4000-a000-000000000001",
        meeting_date: "2026-06-22",
        title: null,
        theme: null,
        description: null,
        location: null,
        essay_deadline: null,
        status: "deleted",
      }).success,
    ).toBe(false);
  });

  it("accepts a safe public meeting row", () => {
    expect(
      publicMeetingRowSchema.safeParse({
        junto_slug: "philadelphia",
        meeting_date: "2026-06-22",
        title: "What do we owe the future?",
        theme: null,
        description: null,
        status: "completed",
      }).success,
    ).toBe(true);
  });

  it("rejects a public row carrying any unexpected private field", () => {
    for (const extra of [
      { location: "Thomas's apartment" },
      { essay_deadline: "2026-06-20T18:00:00+00:00" },
      { created_by: "00000000-0000-4000-a000-000000000001" },
      { essay_count: 4 },
    ]) {
      expect(
        publicMeetingRowSchema.safeParse({
          junto_slug: "philadelphia",
          meeting_date: "2026-06-22",
          title: null,
          theme: null,
          description: null,
          status: "completed",
          ...extra,
        }).success,
      ).toBe(false);
    }
  });
});

describe("meetingWriteErrorKey", () => {
  it("maps database errors to safe, credential-free keys", () => {
    expect(meetingWriteErrorKey(null)).toBeNull();
    expect(meetingWriteErrorKey({ code: "23505" })).toBe("date-taken");
    expect(meetingWriteErrorKey({ code: "42501" })).toBe("not-permitted");
    expect(meetingWriteErrorKey({ code: "XX000" })).toBe("request-failed");
    expect(meetingWriteErrorKey({})).toBe("request-failed");
  });
});
