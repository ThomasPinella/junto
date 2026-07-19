// Canonical routing decisions (.dev/runs/core-product/implementation.md,
// "Decisions and boundaries"): chapter pages live under /juntos/[juntoSlug]
// and essay pages under /essays/[essaySlug]. Later tasks implement those
// dynamic pages; nothing may invent competing URL shapes in the meantime.
export const routes = {
  home: "/",
  essays: "/essays",
  meetings: "/meetings",
  authors: "/authors",
  about: "/about",
  portal: "/portal",
  portalSignIn: "/portal/sign-in",
  authCallback: "/auth/callback",
  junto(juntoSlug: string): string {
    return `/juntos/${encodeURIComponent(juntoSlug)}`;
  },
  // The documented public meeting URL shape (docs/content/meetings.md):
  // /juntos/san-diego/meetings/2026-06-22
  publicMeeting(
    juntoSlug: string,
    meetingDate: string,
  ): `/juntos/${string}/meetings/${string}` {
    return `/juntos/${encodeURIComponent(juntoSlug)}/meetings/${encodeURIComponent(meetingDate)}`;
  },
  portalJunto(juntoSlug: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}`;
  },
  portalMeetings(juntoSlug: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/meetings`;
  },
  portalEssays(juntoSlug: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/essays`;
  },
  portalEssayNew(juntoSlug: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/essays/new`;
  },
  portalEssayEdit(juntoSlug: string, essayId: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/essays/${encodeURIComponent(essayId)}/edit`;
  },
  portalEssayPreview(juntoSlug: string, essayId: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/essays/${encodeURIComponent(essayId)}/preview`;
  },
  portalMeeting(juntoSlug: string, meetingId: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/meetings/${encodeURIComponent(meetingId)}`;
  },
  portalMeetingNew(juntoSlug: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/meetings/new`;
  },
  portalMeetingEdit(juntoSlug: string, meetingId: string): `/portal/${string}` {
    return `/portal/${encodeURIComponent(juntoSlug)}/meetings/${encodeURIComponent(meetingId)}/edit`;
  },
  essay(essaySlug: string): `/essays/${string}` {
    return `/essays/${encodeURIComponent(essaySlug)}`;
  },
} as const;
