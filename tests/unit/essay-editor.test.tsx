import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EssayEditor } from "@/app/portal/[juntoSlug]/essays/essay-editor";

const save = vi.fn(async () => undefined);
const publish = vi.fn(async () => undefined);

afterEach(cleanup);

function renderEditor(
  overrides: Partial<Parameters<typeof EssayEditor>[0]["initialValue"]> = {},
) {
  return render(
    <EssayEditor
      initialValue={{
        title: "A considered title",
        subtitle: "A quieter line",
        bodyMarkdown: "## The real preview\n\nA **rendered** paragraph.",
        meetingId: null,
        status: "draft",
        visibility: "members_only",
        ...overrides,
      }}
      juntoSlug="elm"
      meetings={[]}
      publishAction={publish}
      saveAction={save}
    />,
  );
}

describe("EssayEditor", () => {
  it("renders the canonical MarkdownContent preview with reading typography", () => {
    const { container } = renderEditor();
    expect(
      screen.getByRole("heading", { level: 2, name: "The real preview" }),
    ).toBeTruthy();
    expect(screen.getByText("rendered").tagName).toBe("STRONG");
    expect(container.querySelector('[class*="content"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain("dangerouslySetInnerHTML");
  });

  it("presents publication status and visibility as distinct named facts", () => {
    renderEditor();
    const status = screen.getByText("Publication status").closest("div");
    const visibility = screen
      .getByText("Visibility", { selector: "dt" })
      .closest("div");
    expect(status?.textContent).toContain("Draft");
    expect(visibility?.textContent).toContain("Junto members only");
  });

  it("reveals explicit internet confirmation for new public exposure", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("radio", { name: /Public/ }));
    const checkbox = screen.getByRole("checkbox", {
      name: /readable by anyone on the internet/i,
    });
    expect(checkbox).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish essay" }));
    expect(checkbox).toHaveProperty("required", true);
  });

  it("does not demand a second confirmation for an already-public essay", () => {
    renderEditor({ id: "essay-id", status: "published", visibility: "public" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
