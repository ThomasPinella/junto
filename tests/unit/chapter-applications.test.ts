import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAPTER_APPLICATION_REVIEWER_EMAIL,
  chapterApplicationWriteErrorKey,
  deriveChapterSlug,
  isVerifiedApplicationReviewer,
  parseApplicationDecisionForm,
  parseChapterApplicationForm,
} from "@/lib/chapter-application-domain";
import {
  notifyApplicantOfDecision,
  notifyReviewerOfApplication,
} from "@/lib/chapter-application-email";
import {
  decideChapterApplication,
  listChapterApplications,
  submitChapterApplication,
} from "@/lib/chapter-applications";
import type { SupabaseServerClient } from "@/lib/supabase/server";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

const validForm = () =>
  form({
    "chapter-name": "  Junto Oak  ",
    location: "  Philadelphia  ",
    email: "  Applicant@Example.com  ",
    "intent-note": "  A serious table for neighborhood essays.  ",
    website: "",
  });

function rpcClient(rpc: ReturnType<typeof vi.fn>): SupabaseServerClient {
  return { rpc } as unknown as SupabaseServerClient;
}

describe("chapter application validation", () => {
  it("trims bounded fields and normalizes the applicant email", () => {
    expect(parseChapterApplicationForm(validForm())).toEqual({
      ok: true,
      input: {
        chapterName: "Junto Oak",
        location: "Philadelphia",
        applicantEmail: "applicant@example.com",
        intentNote: "A serious table for neighborhood essays.",
        website: "",
      },
    });
  });

  it.each([
    ["chapter-name", "", "name-invalid"],
    ["chapter-name", "x".repeat(121), "name-invalid"],
    ["location", "x".repeat(241), "location-invalid"],
    ["email", "not-an-email", "email-invalid"],
    ["intent-note", "x".repeat(1001), "note-invalid"],
    ["website", "x".repeat(201), "request-invalid"],
  ])("rejects malformed or oversized %s", (field, value, errorKey) => {
    const data = validForm();
    data.set(field, value);
    expect(parseChapterApplicationForm(data)).toEqual({ ok: false, errorKey });
  });

  it("rejects file parts instead of coercing them", () => {
    const data = validForm();
    data.set("intent-note", new File(["note"], "note.txt"));
    expect(parseChapterApplicationForm(data)).toEqual({
      ok: false,
      errorKey: "note-invalid",
    });
  });

  it("derives an editable bounded slug and preserves exact reserved slugs", () => {
    expect(deriveChapterSlug("  Société & Oak Table  ")).toBe(
      "societe-oak-table",
    );
    expect(deriveChapterSlug("***")).toBe("chapter");
    const applicationId = "11111111-2222-4333-8444-555555555555";
    for (const chapterSlug of ["sign-in", "applications"]) {
      expect(
        parseApplicationDecisionForm(
          form({
            "application-id": applicationId,
            "chapter-slug": chapterSlug,
          }),
          "approve",
        ),
      ).toEqual({ ok: false, errorKey: "slug-invalid" });
    }
    expect(
      parseApplicationDecisionForm(
        form({
          "application-id": applicationId,
          "chapter-slug": "applications-circle",
        }),
        "approve",
      ),
    ).toEqual({
      ok: true,
      input: {
        applicationId,
        decision: "approve",
        chapterSlug: "applications-circle",
      },
    });
  });

  it("accepts only the exact normalized verified reviewer", () => {
    expect(
      isVerifiedApplicationReviewer({
        email: " TXPINELLA@GMAIL.COM ",
        email_confirmed_at: "2026-08-31T00:00:00Z",
      }),
    ).toBe(true);
    expect(
      isVerifiedApplicationReviewer({
        email: CHAPTER_APPLICATION_REVIEWER_EMAIL,
        email_confirmed_at: null,
      }),
    ).toBe(false);
    expect(
      isVerifiedApplicationReviewer({
        email: "other@example.com",
        email_confirmed_at: "2026-08-31T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("maps database failures to bounded application errors", () => {
    expect(chapterApplicationWriteErrorKey({ code: "23505" })).toBe(
      "already-pending",
    );
    expect(chapterApplicationWriteErrorKey({ code: "42501" })).toBe(
      "not-permitted",
    );
    expect(chapterApplicationWriteErrorKey({ code: "22023" })).toBe(
      "input-invalid",
    );
    expect(chapterApplicationWriteErrorKey({ code: "XX000" })).toBe(
      "request-failed",
    );
  });
});

describe("chapter application data boundary", () => {
  it("submits only through the bounded RPC and validates its response", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          application_id: "11111111-2222-4333-8444-555555555555",
          stored: true,
        },
      ],
      error: null,
    });
    const parsed = parseChapterApplicationForm(validForm());
    if (!parsed.ok) throw new Error("fixture should parse");
    await expect(
      submitChapterApplication(rpcClient(rpc), parsed.input),
    ).resolves.toEqual({
      ok: true,
      applicationId: "11111111-2222-4333-8444-555555555555",
      stored: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      "submit_chapter_application",
      expect.objectContaining({
        application_email: "applicant@example.com",
        application_website: "",
      }),
    );
  });

  it("fails closed on malformed successful RPC responses", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ stored: true }], error: null });
    const parsed = parseChapterApplicationForm(validForm());
    if (!parsed.ok) throw new Error("fixture should parse");
    await expect(
      submitChapterApplication(rpcClient(rpc), parsed.input),
    ).resolves.toEqual({ ok: false, errorKey: "request-failed" });
  });

  it("parses only the private reviewer RPC projection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          application_id: "11111111-2222-4333-8444-555555555555",
          chapter_name: "Junto Oak",
          application_location: "Philadelphia",
          applicant_email: "applicant@example.com",
          intent_note: "A serious table.",
          application_status: "pending",
          created_at: "2026-08-31T00:00:00Z",
          reviewed_at: null,
          junto_id: null,
          junto_slug: null,
        },
      ],
      error: null,
    });
    await expect(listChapterApplications(rpcClient(rpc))).resolves.toEqual([
      expect.objectContaining({
        chapterName: "Junto Oak",
        applicantEmail: "applicant@example.com",
        status: "pending",
      }),
    ]);
    expect(rpc).toHaveBeenCalledWith("list_chapter_applications");
  });

  it("passes decision metadata only and safely maps slug collisions", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "private details" },
    });
    await expect(
      decideChapterApplication(rpcClient(rpc), {
        applicationId: "11111111-2222-4333-8444-555555555555",
        decision: "approve",
        chapterSlug: "oak",
      }),
    ).resolves.toEqual({ ok: false, errorKey: "slug-taken" });
  });
});

describe("Resend chapter application email", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://junto.example");
    vi.stubEnv("JUNTO_INITIAL_JUNTO_SLUG", "philadelphia");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the hardcoded sender and reviewer with a review-only link", async () => {
    await expect(
      notifyReviewerOfApplication({
        chapterName: "Junto Oak",
        location: "Philadelphia",
        applicantEmail: "applicant@example.com",
        intentNote: "A serious table.",
      }),
    ).resolves.toEqual({ ok: true });
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer test-resend-key" }),
    );
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "Junto <applications@thomaspinella.com>",
      to: ["txpinella@gmail.com"],
    });
    expect(body.text).toContain("https://junto.example/portal/applications");
    expect(body.text).not.toMatch(/approve=|decline=|decision=/);
  });

  it("sends approved applicants to the existing verified sign-in flow", async () => {
    await notifyApplicantOfDecision({
      applicantEmail: "applicant@example.com",
      chapterName: "Junto Oak",
      decision: "approved",
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ to: ["applicant@example.com"] });
    expect(body.text).toContain("https://junto.example/portal/sign-in");
    expect(body.text).toContain("verified magic link");
  });

  it("returns a bounded failure for HTTP rejection, fetch errors, or missing key", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(
      notifyApplicantOfDecision({
        applicantEmail: "applicant@example.com",
        chapterName: "Junto Oak",
        decision: "declined",
      }),
    ).resolves.toEqual({ ok: false });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network detail"));
    await expect(
      notifyApplicantOfDecision({
        applicantEmail: "applicant@example.com",
        chapterName: "Junto Oak",
        decision: "declined",
      }),
    ).resolves.toEqual({ ok: false });
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      notifyApplicantOfDecision({
        applicantEmail: "applicant@example.com",
        chapterName: "Junto Oak",
        decision: "declined",
      }),
    ).resolves.toEqual({ ok: false });
  });
});
