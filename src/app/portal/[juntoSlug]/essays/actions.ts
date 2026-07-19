"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import {
  hasExplicitPublicExposureConfirmation,
  parseEssayWorkspaceForm,
  type EssayVisibility,
} from "@/lib/essay-domain";
import {
  createEssayDraft,
  getOwnJuntoEssay,
  transitionEssay,
  updateEssayContent,
} from "@/lib/essays";
import { requireJuntoMembership } from "@/lib/portal-access";

async function createFromForm(
  juntoSlug: string,
  formData: FormData,
): Promise<{
  juntoSlug: string;
  essayId: string;
  visibility: EssayVisibility;
  confirmPublic: boolean;
}> {
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  const formUrl = routes.portalEssayNew(membership.juntoSlug);
  const parsed = parseEssayWorkspaceForm(formData);
  if (!parsed.ok) {
    redirect(`${formUrl}?error=${parsed.errorKey}`);
  }
  const created = await createEssayDraft(
    supabase,
    membership.juntoId,
    parsed.input.draft,
  );
  if (!created.ok) {
    redirect(`${formUrl}?error=${created.errorKey}`);
  }
  return {
    juntoSlug: membership.juntoSlug,
    essayId: created.id,
    visibility: parsed.input.visibility,
    confirmPublic: hasExplicitPublicExposureConfirmation(formData),
  };
}

async function transitionOrRedirect(
  juntoSlug: string,
  essayId: string,
  status: "draft" | "published",
  visibility: EssayVisibility,
  confirmPublic: boolean,
  success: string,
): Promise<never> {
  const { supabase } = await requireJuntoMembership(juntoSlug);
  const result = await transitionEssay(
    supabase,
    essayId,
    { status, visibility },
    // The only true path is the exact checked confirmation parsed above.
    confirmPublic === true,
  );
  const editUrl = routes.portalEssayEdit(juntoSlug, essayId);
  if (!result.ok) {
    redirect(`${editUrl}?error=${result.errorKey}`);
  }
  redirect(`${editUrl}?status=${encodeURIComponent(success)}`);
}

export async function saveNewEssay(
  juntoSlug: string,
  formData: FormData,
): Promise<void> {
  const created = await createFromForm(juntoSlug, formData);
  await transitionOrRedirect(
    created.juntoSlug,
    created.essayId,
    "draft",
    created.visibility,
    false,
    "created",
  );
}

export async function publishNewEssay(
  juntoSlug: string,
  formData: FormData,
): Promise<void> {
  const created = await createFromForm(juntoSlug, formData);
  await transitionOrRedirect(
    created.juntoSlug,
    created.essayId,
    "published",
    created.visibility,
    created.confirmPublic,
    "published",
  );
}

async function updateFromForm(
  juntoSlug: string,
  essayId: string,
  formData: FormData,
): Promise<{
  juntoSlug: string;
  essayId: string;
  currentStatus: "draft" | "published";
  visibility: EssayVisibility;
  confirmPublic: boolean;
}> {
  const { supabase, membership, userId } =
    await requireJuntoMembership(juntoSlug);
  const editUrl = routes.portalEssayEdit(membership.juntoSlug, essayId);
  const essay = await getOwnJuntoEssay(
    supabase,
    membership.juntoId,
    userId,
    essayId,
  );
  if (!essay) {
    redirect(routes.portalEssays(membership.juntoSlug));
  }
  const parsed = parseEssayWorkspaceForm(formData);
  if (!parsed.ok) {
    redirect(`${editUrl}?error=${parsed.errorKey}`);
  }
  const updated = await updateEssayContent(
    supabase,
    membership.juntoId,
    essay.id,
    parsed.input.draft,
  );
  if (!updated.ok) {
    redirect(`${editUrl}?error=${updated.errorKey}`);
  }
  return {
    juntoSlug: membership.juntoSlug,
    essayId: essay.id,
    currentStatus: essay.status,
    visibility: parsed.input.visibility,
    confirmPublic: hasExplicitPublicExposureConfirmation(formData),
  };
}

export async function saveEssay(
  juntoSlug: string,
  essayId: string,
  formData: FormData,
): Promise<void> {
  const updated = await updateFromForm(juntoSlug, essayId, formData);
  await transitionOrRedirect(
    updated.juntoSlug,
    updated.essayId,
    updated.currentStatus,
    updated.visibility,
    updated.confirmPublic,
    "saved",
  );
}

export async function publishEssay(
  juntoSlug: string,
  essayId: string,
  formData: FormData,
): Promise<void> {
  const updated = await updateFromForm(juntoSlug, essayId, formData);
  await transitionOrRedirect(
    updated.juntoSlug,
    updated.essayId,
    "published",
    updated.visibility,
    updated.confirmPublic,
    "published",
  );
}

export async function unpublishEssay(
  juntoSlug: string,
  essayId: string,
): Promise<void> {
  const { supabase, membership, userId } =
    await requireJuntoMembership(juntoSlug);
  const essay = await getOwnJuntoEssay(
    supabase,
    membership.juntoId,
    userId,
    essayId,
  );
  if (!essay) {
    redirect(routes.portalEssays(membership.juntoSlug));
  }
  const result = await transitionEssay(
    supabase,
    essay.id,
    { status: "draft", visibility: essay.visibility },
    false,
  );
  const editUrl = routes.portalEssayEdit(membership.juntoSlug, essay.id);
  if (!result.ok) {
    redirect(`${editUrl}?error=${result.errorKey}`);
  }
  redirect(`${editUrl}?status=unpublished`);
}
