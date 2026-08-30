import Link from "next/link";

import { routes } from "@/config/routes";
import { estimateReadingMinutes } from "@/lib/public-archive-domain";
import { formatMeetingDate } from "@/lib/meeting-domain";
import type { PublicEssay } from "@/lib/essay-domain";

import styles from "./public-essay-list.module.css";

export function PublicEssayList({
  essays,
  headingId,
}: {
  essays: PublicEssay[];
  headingId?: string;
}) {
  return (
    <ul className={styles.list} aria-labelledby={headingId}>
      {essays.map((essay) => (
        <li className={styles.row} key={essay.slug}>
          <div className={styles.context}>
            <Link
              className={styles.chapter}
              href={routes.junto(essay.juntoSlug)}
            >
              {essay.juntoName}
            </Link>
            {essay.meetingDate ? (
              <Link
                className={styles.meeting}
                href={routes.publicMeeting(essay.juntoSlug, essay.meetingDate)}
              >
                <time dateTime={essay.meetingDate}>
                  {formatMeetingDate(essay.meetingDate)}
                </time>
                {essay.meetingTitle ? ` · ${essay.meetingTitle}` : ""}
              </Link>
            ) : (
              <time className={styles.meeting} dateTime={essay.publishedAt}>
                {new Date(essay.publishedAt).toLocaleDateString("en-US", {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </time>
            )}
          </div>
          <Link className={styles.title} href={routes.essay(essay.slug)}>
            {essay.title}
          </Link>
          {essay.subtitle ? (
            <p className={styles.subtitle}>{essay.subtitle}</p>
          ) : null}
          <p className={styles.byline}>
            By{" "}
            <Link href={routes.author(essay.authorSlug)}>
              {essay.authorName}
            </Link>{" "}
            · {estimateReadingMinutes(essay.bodyMarkdown)} min read
          </p>
        </li>
      ))}
    </ul>
  );
}
