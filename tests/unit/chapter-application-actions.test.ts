import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAnon: vi.fn(),
  submit: vi.fn(),
  notifyReviewer: vi.fn(),
  requireReviewer: vi.fn(),
  decide: vi.fn(),
  notifyApplicant: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: mocks.createAnon,
}));
vi.mock("@/lib/chapter-applications", () => ({
  submitChapterApplication: mocks.submit,
  decideChapterApplication: mocks.decide,
}));
vi.mock("@/lib/chapter-application-email", () => ({
  notifyReviewerOfApplication: mocks.notifyReviewer,
  notifyApplicantOfDecision: mocks.notifyApplicant,
}));
vi.mock("@/lib/portal-access", () => ({
  requireApplicationReviewer: mocks.requireReviewer,
}));

import { submitApplication } from "@/app/(public)/start-a-chapter/actions";
import {
  approveApplication,
  declineApplication,
} from "@/app/portal/applications/actions";

function applicationForm(): FormData {
  const data = new FormData();
  data.set("chapter-name", "Junto Oak");
  data.set("location", "Philadelphia");
  data.set("email", "applicant@example.com");
  data.set("intent-note", "A serious local table.");
  data.set("website", "");
  return data;
}

function decisionForm(): FormData {
  const data = new FormData();
  data.set("application-id", "11111111-2222-4333-8444-555555555555");
  data.set("chapter-slug", "oak");
  return data;
}

describe("chapter application Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAnon.mockReturnValue({ marker: "anon-client" });
    mocks.requireReviewer.mockResolvedValue({
      supabase: { marker: "reviewer-client" },
    });
    mocks.submit.mockResolvedValue({
      ok: true,
      stored: true,
      applicationId: "11111111-2222-4333-8444-555555555555",
    });
    mocks.notifyReviewer.mockResolvedValue({ ok: true });
    mocks.decide.mockResolvedValue({
      ok: true,
      applicationId: "11111111-2222-4333-8444-555555555555",
      status: "approved",
      applicantEmail: "applicant@example.com",
      chapterName: "Junto Oak",
      chapterId: "22222222-2222-4333-8444-555555555555",
      chapterSlug: "oak",
    });
    mocks.notifyApplicant.mockResolvedValue({ ok: true });
  });

  it("uses the anonymous client and reports post-write notification failure honestly", async () => {
    mocks.notifyReviewer.mockResolvedValue({ ok: false });
    await expect(submitApplication(applicationForm())).rejects.toThrow(
      "REDIRECT:/start-a-chapter?status=submitted-notification-failed",
    );
    expect(mocks.submit).toHaveBeenCalledWith(
      { marker: "anon-client" },
      expect.objectContaining({ applicantEmail: "applicant@example.com" }),
    );
    expect(mocks.notifyReviewer).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the database honeypot result stored nothing", async () => {
    mocks.submit.mockResolvedValue({
      ok: true,
      stored: false,
      applicationId: null,
    });
    await expect(submitApplication(applicationForm())).rejects.toThrow(
      "REDIRECT:/start-a-chapter?status=submitted",
    );
    expect(mocks.notifyReviewer).not.toHaveBeenCalled();
  });

  it("does not send email after a duplicate or failed write", async () => {
    mocks.submit.mockResolvedValue({ ok: false, errorKey: "already-pending" });
    await expect(submitApplication(applicationForm())).rejects.toThrow(
      "error=already-pending",
    );
    expect(mocks.notifyReviewer).not.toHaveBeenCalled();
  });

  it("authorizes the reviewer before parsing or deciding", async () => {
    mocks.requireReviewer.mockRejectedValue(new Error("SERVER-DENIED"));
    await expect(approveApplication(new FormData())).rejects.toThrow(
      "SERVER-DENIED",
    );
    expect(mocks.decide).not.toHaveBeenCalled();
    expect(mocks.notifyApplicant).not.toHaveBeenCalled();
  });

  it("approves through the reviewer client and distinguishes notification failure", async () => {
    mocks.notifyApplicant.mockResolvedValue({ ok: false });
    await expect(approveApplication(decisionForm())).rejects.toThrow(
      "status=approved-notification-failed",
    );
    expect(mocks.decide).toHaveBeenCalledWith(
      { marker: "reviewer-client" },
      {
        applicationId: "11111111-2222-4333-8444-555555555555",
        decision: "approve",
        chapterSlug: "oak",
      },
    );
    expect(mocks.notifyApplicant).toHaveBeenCalledWith({
      applicantEmail: "applicant@example.com",
      chapterName: "Junto Oak",
      decision: "approved",
    });
  });

  it("declines durably without accepting a chapter slug", async () => {
    mocks.decide.mockResolvedValue({
      ok: true,
      applicationId: "11111111-2222-4333-8444-555555555555",
      status: "declined",
      applicantEmail: "applicant@example.com",
      chapterName: "Junto Oak",
      chapterId: null,
      chapterSlug: null,
    });
    await expect(declineApplication(decisionForm())).rejects.toThrow(
      "status=declined",
    );
    expect(mocks.decide).toHaveBeenCalledWith(
      { marker: "reviewer-client" },
      expect.objectContaining({ decision: "decline", chapterSlug: null }),
    );
  });
});
