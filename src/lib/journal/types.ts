export type Inline = string | { bold: string } | { text: string; href: string };

export type Block =
  | { type: "h2"; text: string }
  | { type: "p"; content: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "table"; head: string[]; rows: Inline[][][] };

export type JournalEntry = {
  slug: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  summary: string;
  blocks: Block[];
};
