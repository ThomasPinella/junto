import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { buildPublicArchive } from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../publication.module.css";

export const metadata: Metadata = { title: "Authors" };
export const dynamic = "force-dynamic";

export default async function AuthorsPage() {
  let archive = null;
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    archive = buildPublicArchive(
      await listPublicEssays(supabase, { limit: 100, signal }),
    );
  } catch {
    archive = null;
  }

  return (
    <article>
      <p className={styles.metaLabel}>Contributors to the public record</p>
      <h1>Authors</h1>
      <p className={styles.lede}>
        Every Junto essay is signed. Authors appear here only through work they
        have chosen to publish across active public chapters.
      </p>
      <hr className={styles.rule} />
      {archive && archive.authors.length > 0 ? (
        <ul className={styles.authorList}>
          {archive.authors.map((author) => (
            <li key={author.slug}>
              <Link
                className={styles.authorName}
                href={routes.author(author.slug)}
              >
                {author.name}
              </Link>
              <p>{author.essays[0]?.title}</p>
              <ul className={styles.chapterInlineList} aria-label="Chapters">
                {author.chapters.map((chapter) => (
                  <li key={chapter.slug}>
                    <Link href={routes.junto(chapter.slug)}>
                      {chapter.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          The public author record is quiet for now.
        </p>
      )}
    </article>
  );
}
