import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { getPublicJunto } from "@/lib/meetings";
import { buildPublicArchive } from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../publication.module.css";

export const metadata: Metadata = { title: "Authors" };
export const dynamic = "force-dynamic";

export default async function AuthorsPage() {
  const site = siteConfig();
  let archive = null;
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, site.initialJuntoSlug, signal);
    if (junto) {
      archive = buildPublicArchive(
        await listPublicEssays(supabase, {
          juntoSlug: junto.slug,
          limit: 100,
          signal,
        }),
      );
    }
  } catch {
    archive = null;
  }

  return (
    <article>
      <p className={styles.metaLabel}>Contributors to the public record</p>
      <h1>Authors</h1>
      <p className={styles.lede}>
        Every Junto essay is signed. Authors appear here only through work they
        have chosen to publish.
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
              {author.meetings[0] ? (
                <a
                  className={styles.contextLink}
                  href={routes.essayArchive({
                    meetingDate: author.meetings[0].date,
                  })}
                >
                  {author.meetings[0].title ?? author.meetings[0].date}
                </a>
              ) : null}
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
