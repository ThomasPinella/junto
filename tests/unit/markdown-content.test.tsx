import { readFileSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "@/components/markdown-content";

// The safe Markdown renderer: canonical stored Markdown in, semantic HTML
// out, with raw HTML, scripts, dangerous URLs, and unexpected elements
// neutralized by construction. Tests assert semantics — what reaches the
// DOM — not snapshots.

function renderMarkdown(markdown: string): HTMLElement {
  return render(<MarkdownContent markdown={markdown} />).container;
}

describe("MarkdownContent — supported features", () => {
  it("renders headings, paragraphs, emphasis, and strong text", () => {
    const container = renderMarkdown(
      "# Title\n\n## Section\n\nA *quiet* and **firm** paragraph.",
    );
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("h2")?.textContent).toBe("Section");
    expect(container.querySelector("em")?.textContent).toBe("quiet");
    expect(container.querySelector("strong")?.textContent).toBe("firm");
    expect(container.querySelector("p")?.textContent).toContain("quiet");
  });

  it("renders block quotes, lists, and horizontal rules", () => {
    const container = renderMarkdown(
      "> A borrowed thought.\n\n1. first\n2. second\n\n- one\n- two\n\n---",
    );
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "A borrowed thought.",
    );
    expect(
      Array.from(container.querySelectorAll("ol li")).map(
        (item) => item.textContent,
      ),
    ).toEqual(["first", "second"]);
    expect(
      Array.from(container.querySelectorAll("ul li")).map(
        (item) => item.textContent,
      ),
    ).toEqual(["one", "two"]);
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders fenced and inline code without executing anything", () => {
    const container = renderMarkdown(
      "Use `btrim` here.\n\n```\nconst x = 1;\n```",
    );
    const codes = container.querySelectorAll("code");
    expect(codes.length).toBe(2);
    expect(container.querySelector("pre code")?.textContent).toContain(
      "const x = 1;",
    );
  });

  it("renders internal links as plain same-origin anchors", () => {
    const container = renderMarkdown("[our archive](/essays/on-patience)");
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/essays/on-patience");
    expect(anchor?.getAttribute("target")).toBeNull();
  });

  it("renders external links with safe target and rel", () => {
    const container = renderMarkdown("[a source](https://example.com/source)");
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/source");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    const rel = anchor?.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });
});

describe("MarkdownContent — adversarial input", () => {
  it("never renders script elements from raw HTML", () => {
    const container = renderMarkdown(
      "Before\n\n<script>window.pwned = true;</script>\n\nAfter",
    );
    expect(container.querySelector("script")).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>).pwned,
    ).toBeUndefined();
  });

  it("never renders iframes, objects, embeds, or SVG payloads", () => {
    const container = renderMarkdown(
      [
        '<iframe src="https://evil.example"></iframe>',
        '<object data="https://evil.example"></object>',
        '<embed src="https://evil.example">',
        '<svg onload="window.pwned=1"><circle /></svg>',
      ].join("\n\n"),
    );
    for (const selector of ["iframe", "object", "embed", "svg"]) {
      expect(container.querySelector(selector), selector).toBeNull();
    }
  });

  it("never carries event handler attributes into the DOM", () => {
    const container = renderMarkdown(
      '<img src="x" onerror="window.pwned=1">\n\n<p onclick="window.pwned=1">hi</p>',
    );
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.querySelector("img")).toBeNull();
  });

  it("neutralizes javascript: links into inert text", () => {
    const container = renderMarkdown("[click me](javascript:alert(1))");
    const anchor = container.querySelector("a");
    expect(anchor).toBeNull();
    expect(container.textContent).toContain("click me");
  });

  it("neutralizes dangerous data: and vbscript: URLs", () => {
    for (const target of [
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "JaVaScRiPt:alert(1)",
    ]) {
      const container = renderMarkdown(`[x](${target})`);
      const anchor = container.querySelector("a");
      expect(anchor?.getAttribute("href") ?? "", target).toBe("");
      expect(container.textContent).toContain("x");
    }
  });

  it("treats protocol-relative links as external with safe rel", () => {
    const container = renderMarkdown("[surprise](//evil.example/path)");
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("rel") ?? "").toContain("noopener");
    expect(anchor?.getAttribute("target")).toBe("_blank");
  });

  it("drops markdown images rather than loading remote or data content", () => {
    const container = renderMarkdown(
      "![tracker](https://evil.example/pixel.gif)\n\n![svg](data:image/svg+xml,<svg onload=alert(1)/>)",
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps raw-HTML link markup inert", () => {
    const container = renderMarkdown(
      '<a href="javascript:alert(1)">raw anchor</a>',
    );
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href") ?? "").not.toContain("javascript:");
    }
  });

  it("fails closed on unexpected non-string input", () => {
    const { container } = render(
      <MarkdownContent markdown={undefined as unknown as string} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders empty input as empty output without error", () => {
    expect(renderMarkdown("").querySelectorAll("*").length).toBeLessThanOrEqual(
      1,
    );
  });
});

describe("MarkdownContent — implementation boundaries", () => {
  it("never uses dangerouslySetInnerHTML or a raw-HTML plugin", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../src/components/markdown-content.tsx"),
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source.toLowerCase()).not.toContain("rehype-raw");
    expect(source).not.toContain("allowDangerousHtml");
  });
});
