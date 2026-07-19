"use client";

import Link from "next/link";
import { useState } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { routes } from "@/config/routes";
import {
  essayStatusLabel,
  essayVisibilityLabel,
  type EssayStatus,
  type EssayVisibility,
} from "@/lib/essay-domain";
import {
  formatMeetingDate,
  meetingDisplayName,
  type Meeting,
} from "@/lib/meeting-domain";

import styles from "./essays.module.css";

export interface EssayEditorValue {
  id?: string;
  title: string;
  subtitle: string | null;
  bodyMarkdown: string;
  meetingId: string | null;
  status: EssayStatus;
  visibility: EssayVisibility;
  slug?: string;
}

function meetingLabel(meeting: Meeting): string {
  const name = meetingDisplayName(meeting) ?? "Open topic";
  return `${formatMeetingDate(meeting.meetingDate)} — ${name}`;
}

export function EssayEditor({
  juntoSlug,
  meetings,
  initialValue,
  saveAction,
  publishAction,
  unpublishAction,
}: {
  juntoSlug: string;
  meetings: Meeting[];
  initialValue: EssayEditorValue;
  saveAction: (formData: FormData) => Promise<void>;
  publishAction: (formData: FormData) => Promise<void>;
  unpublishAction?: (formData: FormData) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialValue.title);
  const [subtitle, setSubtitle] = useState(initialValue.subtitle ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(initialValue.bodyMarkdown);
  const [visibility, setVisibility] = useState<EssayVisibility>(
    initialValue.visibility,
  );
  const [publishing, setPublishing] = useState(false);
  const publicAlreadyExposed =
    initialValue.status === "published" && initialValue.visibility === "public";
  const confirmationRequired = visibility === "public" && !publicAlreadyExposed;

  return (
    <form action={saveAction} className={styles.editorForm}>
      <dl className={styles.stateSummary}>
        <div>
          <dt>Publication status</dt>
          <dd>{essayStatusLabel(initialValue.status)}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{essayVisibilityLabel(visibility)}</dd>
        </div>
      </dl>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="title">
          Title
        </label>
        <input
          className={styles.input}
          id="title"
          maxLength={200}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          required
          type="text"
          value={title}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="subtitle">
          Subtitle <span className={styles.optional}>Optional</span>
        </label>
        <input
          className={styles.input}
          id="subtitle"
          maxLength={300}
          name="subtitle"
          onChange={(event) => setSubtitle(event.target.value)}
          type="text"
          value={subtitle}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="meeting-id">
          Meeting
        </label>
        <select
          className={styles.input}
          defaultValue={initialValue.meetingId ?? ""}
          id="meeting-id"
          name="meeting-id"
        >
          <option value="">Choose a meeting</option>
          {initialValue.meetingId &&
          !meetings.some((meeting) => meeting.id === initialValue.meetingId) ? (
            <option value={initialValue.meetingId}>
              Current meeting — details temporarily unavailable
            </option>
          ) : null}
          {meetings.map((meeting) => (
            <option key={meeting.id} value={meeting.id}>
              {meetingLabel(meeting)}
            </option>
          ))}
        </select>
        <p className={styles.fieldHint}>
          Essays are written for the table. Choose the gathering this essay
          belongs to; you can still keep an early draft unassigned.
        </p>
      </div>
      <fieldset className={styles.visibilityFieldset}>
        <legend className={styles.fieldLabel}>Visibility</legend>
        <label className={styles.radioLabel}>
          <input
            checked={visibility === "members_only"}
            name="visibility"
            onChange={() => setVisibility("members_only")}
            type="radio"
            value="members_only"
          />
          <span>
            <strong>Junto members only</strong>
            <small>Only active members of this Junto can read it.</small>
          </span>
        </label>
        <label className={styles.radioLabel}>
          <input
            checked={visibility === "public"}
            name="visibility"
            onChange={() => setVisibility("public")}
            type="radio"
            value="public"
          />
          <span>
            <strong>Public</strong>
            <small>When published, anyone on the internet can read it.</small>
          </span>
        </label>
      </fieldset>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="body-markdown">
          Essay in Markdown
        </label>
        <textarea
          className={styles.markdownInput}
          id="body-markdown"
          maxLength={100000}
          name="body-markdown"
          onChange={(event) => setBodyMarkdown(event.target.value)}
          spellCheck
          value={bodyMarkdown}
        />
        <p className={styles.fieldHint}>
          Headings, emphasis, block quotes, links, lists, rules, and code are
          supported. Raw HTML is never rendered.
        </p>
      </div>

      {confirmationRequired ? (
        <label
          className={styles.confirmation}
          htmlFor="confirm-public-exposure"
        >
          <input
            id="confirm-public-exposure"
            name="confirm-public-exposure"
            required={publishing}
            type="checkbox"
          />
          <span>
            I understand that publishing this essay as <strong>Public</strong>{" "}
            makes it readable by anyone on the internet.
          </span>
        </label>
      ) : null}

      <div className={styles.actionRow}>
        <button
          className={styles.quietButton}
          onClick={() => setPublishing(false)}
          type="submit"
        >
          {initialValue.id ? "Save changes" : "Save draft"}
        </button>
        {initialValue.status === "draft" ? (
          <button
            className={styles.primaryButton}
            formAction={publishAction}
            onClick={() => setPublishing(true)}
            type="submit"
          >
            Publish essay
          </button>
        ) : null}
        {initialValue.status === "published" && unpublishAction ? (
          <button
            className={styles.quietButton}
            formAction={unpublishAction}
            formNoValidate
            type="submit"
          >
            Unpublish
          </button>
        ) : null}
        {initialValue.id ? (
          <Link
            className={styles.textAction}
            href={routes.portalEssayPreview(juntoSlug, initialValue.id)}
          >
            Open saved preview
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="essay-preview" className={styles.preview}>
        <p className={styles.previewLabel}>Reading preview</p>
        <h2 className={styles.previewTitle} id="essay-preview">
          {title.trim() || "Untitled essay"}
        </h2>
        {subtitle.trim() ? (
          <p className={styles.previewSubtitle}>{subtitle}</p>
        ) : null}
        <div className={styles.previewBody}>
          {bodyMarkdown ? (
            <MarkdownContent markdown={bodyMarkdown} />
          ) : (
            <p className={styles.emptyPreview}>
              Your rendered essay will appear here as you write.
            </p>
          )}
        </div>
      </section>
    </form>
  );
}
