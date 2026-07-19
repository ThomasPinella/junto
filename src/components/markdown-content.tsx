// The single safe Markdown renderer. Essays store canonical Markdown
// (docs/planning/product-decisions.md §14); every rendered surface — T06
// editor preview and T07 public reading pages alike — derives its HTML here
// and nowhere else, so preview and publication stay visually consistent and
// the sanitization boundary has exactly one implementation.
//
// Safety is by construction, not by filtering:
//   * only the documented basic-Markdown elements may render at all
//     (docs/content/essays.md §6.1) — the whitelist below; anything else,
//     including images, is unwrapped to its inert text content;
//   * raw HTML never becomes DOM: react-markdown without a raw-HTML plugin
//     drops html nodes, and skipHtml removes them from the output entirely,
//     so scripts, iframes, objects, embeds, SVG payloads, and event-handler
//     attributes cannot exist in the result;
//   * URLs pass react-markdown's default transform (http/https/mailto and
//     relative only; javascript:, vbscript:, and dangerous data: collapse to
//     nothing) and a link whose URL was neutralized renders as plain text;
//   * external links — including protocol-relative surprises — open apart
//     from the reading session with rel="noopener noreferrer".
import type { AnchorHTMLAttributes, ReactNode } from "react";
import Markdown from "react-markdown";

import styles from "./markdown-content.module.css";

// The documented basic Markdown support: headings, paragraphs, emphasis,
// strong, block quotes, links, lists, horizontal rules, and code. `br` backs
// hard line breaks inside paragraphs.
const ALLOWED_ELEMENTS = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
] as const;

// A URL with any protocol — or a protocol-relative host — leaves the
// publication; everything else is a same-origin path or fragment.
function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function SafeLink({
  href,
  children,
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  // The default URL transform has already neutralized dangerous protocols
  // to an empty href; fail closed by rendering inert text, never a link.
  if (!href) {
    return <span>{children}</span>;
  }
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return <a href={href}>{children}</a>;
}

export function MarkdownContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  // Fail closed on malformed data: only a real string renders.
  if (typeof markdown !== "string" || markdown === "") {
    return null;
  }
  return (
    <div className={[styles.content, className].filter(Boolean).join(" ")}>
      <Markdown
        allowedElements={[...ALLOWED_ELEMENTS]}
        unwrapDisallowed
        skipHtml
        components={{ a: SafeLink }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
