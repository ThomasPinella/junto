// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("presents the uppercase JUNTO wordmark linking home", () => {
    render(<SiteHeader chapterName="Philadelphia" />);
    const wordmark = screen.getByRole("link", { name: "JUNTO" });
    expect(wordmark.textContent).toBe("JUNTO");
    expect(wordmark.getAttribute("href")).toBe("/");
  });

  it("shows the chapter name beside the masthead", () => {
    render(<SiteHeader chapterName="Philadelphia" />);
    expect(screen.getByText("Philadelphia")).toBeTruthy();
  });

  it("offers the quiet publication navigation", () => {
    render(<SiteHeader chapterName="Philadelphia" />);
    const nav = screen.getByRole("navigation", { name: "Publication" });
    const links = nav.querySelectorAll("a");
    const entries = Array.from(links).map((link) => [
      link.textContent,
      link.getAttribute("href"),
    ]);
    expect(entries).toEqual([
      ["Archive", "/essays"],
      ["Meetings", "/meetings"],
      ["Authors", "/authors"],
      ["About", "/about"],
      ["Member Portal", "/portal"],
    ]);
  });
});
