// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("presents the uppercase JUNTO wordmark linking home", () => {
    render(<SiteHeader contextLabel="Network archive" />);
    const wordmark = screen.getByRole("link", { name: "JUNTO" });
    expect(wordmark.textContent).toBe("JUNTO");
    expect(wordmark.getAttribute("href")).toBe("/");
  });

  it("shows the network context beside the masthead", () => {
    render(<SiteHeader contextLabel="Network archive" />);
    expect(screen.getByText("Network archive")).toBeTruthy();
  });

  it("offers the quiet publication navigation", () => {
    render(<SiteHeader contextLabel="Network archive" />);
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
      ["Start a chapter", "/start-a-chapter"],
      ["Member Portal", "/portal"],
    ]);
  });
});
