import { describe, expect, it } from "vitest";

import { routes } from "@/config/routes";

describe("routes", () => {
  it("keeps the public publication routes stable", () => {
    expect(routes.home).toBe("/");
    expect(routes.essays).toBe("/essays");
    expect(routes.meetings).toBe("/meetings");
    expect(routes.authors).toBe("/authors");
    expect(routes.about).toBe("/about");
    expect(routes.portal).toBe("/portal");
  });

  it("places chapter pages under /juntos/[juntoSlug]", () => {
    expect(routes.junto("philadelphia")).toBe("/juntos/philadelphia");
  });

  it("places essay pages under /essays/[essaySlug]", () => {
    expect(routes.essay("what-do-we-owe-the-future")).toBe(
      "/essays/what-do-we-owe-the-future",
    );
  });

  it("places author pages under /authors/[authorSlug] and encodes filters", () => {
    expect(routes.author("maya/chen")).toBe("/authors/maya%2Fchen");
    expect(routes.essayArchive({ authorSlug: "maya chen" })).toBe(
      "/essays?author=maya+chen",
    );
    expect(routes.essayArchive({ meetingDate: "2026/07/12" })).toBe(
      "/essays?meeting=2026%2F07%2F12",
    );
  });

  it("uses the documented public meeting URL shape", () => {
    // docs/content/meetings.md: /juntos/san-diego/meetings/2026-06-22
    expect(routes.publicMeeting("san-diego", "2026-06-22")).toBe(
      "/juntos/san-diego/meetings/2026-06-22",
    );
  });

  it("scopes private meeting routes to the selected Junto", () => {
    expect(routes.portalMeetings("philadelphia")).toBe(
      "/portal/philadelphia/meetings",
    );
    expect(routes.portalMeetingNew("philadelphia")).toBe(
      "/portal/philadelphia/meetings/new",
    );
    expect(
      routes.portalMeeting(
        "philadelphia",
        "00000000-0000-4000-a000-000000000001",
      ),
    ).toBe(
      "/portal/philadelphia/meetings/00000000-0000-4000-a000-000000000001",
    );
    expect(
      routes.portalMeetingEdit(
        "philadelphia",
        "00000000-0000-4000-a000-000000000001",
      ),
    ).toBe(
      "/portal/philadelphia/meetings/00000000-0000-4000-a000-000000000001/edit",
    );
  });

  it("scopes the author workspace routes to the selected Junto", () => {
    const id = "00000000-0000-4000-a000-000000000001";
    expect(routes.portalEssays("philadelphia")).toBe(
      "/portal/philadelphia/essays",
    );
    expect(routes.portalEssayNew("philadelphia")).toBe(
      "/portal/philadelphia/essays/new",
    );
    expect(routes.portalEssayEdit("philadelphia", id)).toBe(
      `/portal/philadelphia/essays/${id}/edit`,
    );
    expect(routes.portalEssayPreview("philadelphia", id)).toBe(
      `/portal/philadelphia/essays/${id}/preview`,
    );
  });

  it("URL-encodes untrusted route segments", () => {
    expect(routes.publicMeeting("a/b", "c?d")).toBe(
      "/juntos/a%2Fb/meetings/c%3Fd",
    );
    expect(routes.portalMeeting("a b", "x#y")).toBe(
      "/portal/a%20b/meetings/x%23y",
    );
    expect(routes.portalEssayEdit("a b", "x#y")).toBe(
      "/portal/a%20b/essays/x%23y/edit",
    );
  });
});
