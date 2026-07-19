import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getOwn: vi.fn(),
  transition: vi.fn(),
  update: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/portal-access", () => ({
  requireJuntoMembership: mocks.requireMembership,
}));
vi.mock("@/lib/essays", () => ({
  createEssayDraft: mocks.create,
  getOwnJuntoEssay: mocks.getOwn,
  transitionEssay: mocks.transition,
  updateEssayContent: mocks.update,
}));

import {
  publishNewEssay,
  saveEssay,
} from "@/app/portal/[juntoSlug]/essays/actions";

function workspaceForm(confirm?: string): FormData {
  const data = new FormData();
  data.set("title", "A title");
  data.set("subtitle", "");
  data.set("body-markdown", "A body.");
  data.set("meeting-id", "11111111-2222-4333-8444-555555555555");
  data.set("visibility", "public");
  if (confirm !== undefined) data.set("confirm-public-exposure", confirm);
  return data;
}

describe("essay workspace actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMembership.mockResolvedValue({
      supabase: { marker: "user-client" },
      userId: "22222222-2222-4333-8444-555555555555",
      membership: {
        juntoId: "33333333-2222-4333-8444-555555555555",
        juntoSlug: "elm",
      },
    });
    mocks.create.mockResolvedValue({
      ok: true,
      id: "44444444-2222-4333-8444-555555555555",
      slug: "a-title",
    });
    mocks.transition.mockResolvedValue({
      ok: true,
      state: { status: "published", visibility: "public" },
      publishedAt: "2026-07-19T00:00:00Z",
    });
    mocks.update.mockResolvedValue({
      ok: true,
      id: "44444444-2222-4333-8444-555555555555",
    });
  });

  it("uses the server-derived Junto and fails public confirmation closed when absent", async () => {
    await expect(
      publishNewEssay("untrusted-route", workspaceForm()),
    ).rejects.toThrow(/REDIRECT:/);
    expect(mocks.create).toHaveBeenCalledWith(
      { marker: "user-client" },
      "33333333-2222-4333-8444-555555555555",
      expect.objectContaining({ title: "A title" }),
    );
    expect(mocks.transition).toHaveBeenCalledWith(
      { marker: "user-client" },
      "44444444-2222-4333-8444-555555555555",
      { status: "published", visibility: "public" },
      false,
    );
  });

  it("passes literal true only after the exact checked confirmation", async () => {
    await expect(publishNewEssay("elm", workspaceForm("on"))).rejects.toThrow(
      /REDIRECT:/,
    );
    expect(mocks.transition).toHaveBeenLastCalledWith(
      { marker: "user-client" },
      "44444444-2222-4333-8444-555555555555",
      { status: "published", visibility: "public" },
      true,
    );
  });

  it("uniformly redirects before writing when the own-author lookup misses", async () => {
    mocks.getOwn.mockResolvedValue(null);
    await expect(
      saveEssay("elm", "aaaaaaaa-2222-4333-8444-555555555555", workspaceForm()),
    ).rejects.toThrow("REDIRECT:/portal/elm/essays");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
