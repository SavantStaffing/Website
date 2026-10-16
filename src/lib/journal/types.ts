import type { LinkProps } from "@tanstack/react-router";

export type Inline = string | { bold: string } | { text: string; href: string };

export type Block =
  | { type: "h2"; text: string }
  | { type: "p"; content: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "table"; head: string[]; rows: Inline[][][] };

export type JournalCategory = "Career paths" | "Job search";

export type JournalEntry = {
  slug: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  category: JournalCategory;
  summary: string;
  blocks: Block[];
  /** Optional closing call to action, linking to a page on the site. */
  cta?: { title: string; body: string; label: string; to: LinkProps["to"] };
};
