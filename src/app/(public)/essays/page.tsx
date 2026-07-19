import type { Metadata } from "next";
import Link from "next/link";

import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { formatMeetingDate } from "@/lib/meeting-domain";
import { getPublicJunto } from "@/lib/meetings";
import { parseArchiveFilters } from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../publication.module.css";

export const metadata: Metadata = { title: "Essay archive" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EssayArchivePage({ searchParams }: PageProps) {
  const filters = parseArchiveFilters(await searchParams);
  const site = siteConfig();
  let essays = null;
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, site.initialJuntoSlug, signal);
    if (junto && filters) {
      essays = await listPublicEssays(supabase, {
        juntoSlug: junto.slug,
        ...filters,
        limit: 100,
        signal,
      });
    }
  } catch {
    essays = null;
  }

  const filterLabel = filters?.authorSlug
    ? (essays?.[0]?.authorName ?? null)
    : filters?.meetingDate
      ? (essays?.[0]?.meetingTitle ??
        (essays?.length ? formatMeetingDate(filters.meetingDate) : null))
      : null;
  const filtered = Boolean(filters?.authorSlug || filters?.meetingDate);

  return (
    <article>
      <p className={styles.metaLabel}>Public proceedings</p>
      <h1>Essay archive</h1>
      <p className={styles.lede}>
        Essays published by Junto members, each tied to the meeting where it was
        read aloud and discussed.
      </p>
      {filtered && filterLabel ? (
        <div className={styles.filterState}>
          <p>
            Showing essays {filters?.authorSlug ? "by" : "from"} {filterLabel}.
          </p>
          <Link href={routes.essays}>View the full archive</Link>
        </div>
      ) : filtered ? (
        <div className={styles.filterState}>
          <p>No public essays match this view.</p>
          <Link href={routes.essays}>View the full archive</Link>
        </div>
      ) : null}
      <hr className={styles.rule} />
      {essays && essays.length > 0 ? (
        <PublicEssayList essays={essays} />
      ) : (
        <p className={styles.empty}>
          The public essay record is quiet for now.
        </p>
      )}
    </article>
  );
}
