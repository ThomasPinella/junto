import type { Metadata } from "next";

import { routes } from "@/config/routes";
import type { PublicEssay } from "@/lib/essay-domain";
import type { PublicJunto } from "@/lib/meetings";
import type { PublicAuthor } from "@/lib/public-archive-domain";

export const GENERIC_ESSAY_METADATA: Metadata = { title: "Essay" };
export const GENERIC_AUTHOR_METADATA: Metadata = { title: "Author" };
export const GENERIC_JUNTO_METADATA: Metadata = { title: "Junto chapter" };

export function publicJuntoMetadata(
  junto: PublicJunto | null,
  siteUrl: string,
): Metadata {
  if (!junto) return GENERIC_JUNTO_METADATA;
  const description =
    junto.description ?? `Public essays and meetings from ${junto.name}.`;
  const url = new URL(routes.junto(junto.slug), siteUrl).toString();
  return {
    title: junto.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: junto.name,
      description,
      type: "website",
      url,
    },
  };
}

export function publicEssayMetadata(
  essay: PublicEssay | null,
  siteUrl: string,
): Metadata {
  if (!essay) return GENERIC_ESSAY_METADATA;
  const description = essay.subtitle
    ? `${essay.subtitle} — ${essay.juntoName}.`
    : `An essay by ${essay.authorName} from ${essay.juntoName}.`;
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
  const chapterNames = author.chapters
    .map((chapter) => chapter.name)
    .join(", ");
  const description = `Public essays by ${author.name} from ${chapterNames}.`;
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
