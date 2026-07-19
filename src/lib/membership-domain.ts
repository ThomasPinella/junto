import { z } from "zod";

export const invitationRoleSchema = z.enum(["member", "admin"]);

export interface InvitationInput {
  email: string;
  role: z.infer<typeof invitationRoleSchema>;
}

export type InvitationFormResult =
  | { ok: true; input: InvitationInput }
  | {
      ok: false;
      errorKey: "email-invalid" | "role-invalid" | "confirmation-required";
    };

// An invitation grants the ability to create an account and receive a
// durable membership. Treat it as a deliberate authorization change: only
// the exact checked control is accepted at the server boundary.
export function parseInvitationForm(formData: FormData): InvitationFormResult {
  const email = z.email().safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!email.success) return { ok: false, errorKey: "email-invalid" };

  const role = invitationRoleSchema.safeParse(formData.get("role"));
  if (!role.success) return { ok: false, errorKey: "role-invalid" };

  if (formData.get("confirm-invitation") !== "on") {
    return { ok: false, errorKey: "confirmation-required" };
  }

  return { ok: true, input: { email: email.data, role: role.data } };
}
