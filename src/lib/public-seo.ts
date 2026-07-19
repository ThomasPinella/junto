import type { Metadata } from "next";

import { routes } from "@/config/routes";
import type { PublicEssay } from "@/lib/essay-domain";
import type { PublicAuthor } from "@/lib/public-archive-domain";

export const GENERIC_ESSAY_METADATA: Metadata = { title: "Essay" };
export const GENERIC_AUTHOR_METADATA: Metadata = { title: "Author" };

export function publicEssayMetadata(
  essay: PublicEssay | null,
  siteUrl: string,
): Metadata {
  if (!essay) return GENERIC_ESSAY_METADATA;
  const description = essay.subtitle ?? `An essay by ${essay.authorName}.`;
  const url = new URL(routes.essay(essay.slug), siteUrl).toString();
  return {
    title: essay.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: essay.title,
      description,
      type: "article",
      url,
      publishedTime: essay.publishedAt,
      authors: [essay.authorName],
    },
  };
}

export function publicAuthorMetadata(
  author: PublicAuthor | null,
  siteUrl: string,
): Metadata {
  if (!author) return GENERIC_AUTHOR_METADATA;
  const description = `Public essays by ${author.name} in the Junto archive.`;
  const url = new URL(routes.author(author.slug), siteUrl).toString();
  return {
    title: author.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: author.name,
      description,
      type: "profile",
      url,
    },
  };
}
