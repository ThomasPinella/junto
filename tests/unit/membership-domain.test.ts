import { describe, expect, it } from "vitest";

import { parseInvitationForm } from "@/lib/membership-domain";

function invitationForm(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(entries)) form.set(name, value);
  return form;
}

describe("parseInvitationForm", () => {
  it("normalizes a deliberately confirmed approved invitation", () => {
    expect(
      parseInvitationForm(
        invitationForm({
          email: "  New.Member@Example.COM ",
          role: "member",
          "confirm-invitation": "on",
        }),
      ),
    ).toEqual({
      ok: true,
      input: { email: "new.member@example.com", role: "member" },
    });
  });

  it.each([
    ["missing", undefined],
    ["unchecked", ""],
    ["forged", "true"],
  ])("fails closed when confirmation is %s", (_label, confirmation) => {
    const entries: Record<string, string> = {
      email: "approved@example.com",
      role: "member",
    };
    if (confirmation !== undefined) {
      entries["confirm-invitation"] = confirmation;
    }
    expect(parseInvitationForm(invitationForm(entries))).toEqual({
      ok: false,
      errorKey: "confirmation-required",
    });
  });

  it("rejects malformed emails and forged roles", () => {
    expect(
      parseInvitationForm(
        invitationForm({
          email: "not-an-email",
          role: "member",
          "confirm-invitation": "on",
        }),
      ),
    ).toEqual({ ok: false, errorKey: "email-invalid" });
    expect(
      parseInvitationForm(
        invitationForm({
          email: "approved@example.com",
          role: "owner",
          "confirm-invitation": "on",
        }),
      ),
    ).toEqual({ ok: false, errorKey: "role-invalid" });
  });
});
