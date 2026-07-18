import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

// Newsreader carries the masthead and long-form reading; Instrument Sans
// carries navigation, controls, and metadata (DESIGN.md, "Typography").
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Junto",
    template: "%s · Junto",
  },
  description:
    "A public essay archive and private member portal for recurring, in-person, essay-based discussion groups.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${instrumentSans.variable}`}
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
