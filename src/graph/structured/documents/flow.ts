/**
 * The body of a word-processor document (DOCX, ODT) as it is read: paragraphs,
 * headings and tables in order, cut into pages where the editor recorded a page
 * boundary.
 *
 * Responsible for: collecting text into the open paragraph, writing a closed
 * paragraph as a block (a heading block when it has a level), writing a table as
 * one block with a line per row and its cells joined by ` | `, and starting a new
 * page unit at each recorded boundary. The converters only translate their XML
 * into these calls.
 *
 * The non-obvious thing: a boundary inside a paragraph splits it, so the text
 * after the boundary is on the new page's lines; one inside a table, or inside a
 * heading that does not open its page, takes effect after the table or heading,
 * which keeps every following line on its true page.
 */
import type { Block, DocumentUnit } from "./render.js";

interface Paragraph {
  level?: number;
  /** Text between boundaries: each boundary inside the paragraph opens a segment. */
  segments: string[];
}

interface Table {
  rows: string[][];
  row: string[] | null;
  cell: string[] | null;
  /** Boundaries met inside the table, applied once it closes. */
  breaks: number;
}

export class Flow {
  /** Pages when the document records boundaries, otherwise one undivided unit. */
  readonly units: DocumentUnit[];
  private readonly paragraphs: Paragraph[] = [];
  private readonly tables: Table[] = [];

  constructor(paged: boolean) {
    this.units = [{ kind: paged ? "page" : null, blocks: [] }];
  }

  openParagraph(level?: number): void {
    this.paragraphs.push({ ...(level !== undefined ? { level } : {}), segments: [""] });
  }

  /** Set or clear the open paragraph's heading level (1 to 6). */
  setLevel(level: number | undefined): void {
    const p = this.paragraphs[this.paragraphs.length - 1];
    if (!p) return;
    if (level === undefined) delete p.level;
    else p.level = Math.min(6, Math.max(1, level));
  }

  text(text: string): void {
    const p = this.paragraphs[this.paragraphs.length - 1];
    if (p) p.segments[p.segments.length - 1] += text;
  }

  /** A page began here when the editor last laid the document out. */
  pageBreak(): void {
    const table = this.tables[this.tables.length - 1];
    const p = this.paragraphs[this.paragraphs.length - 1];
    if (table) table.breaks++;
    else if (p) p.segments.push("");
    else this.newPage();
  }

  closeParagraph(): void {
    const p = this.paragraphs.pop();
    if (!p) return;
    const whole = p.segments.join("");
    const table = this.tables[this.tables.length - 1];
    if (table?.cell) {
      table.cell.push(whole.replace(/\s+/g, " ").trim());
      table.breaks += p.segments.length - 1;
      return;
    }
    const nested = this.paragraphs.length > 0; // a text box inside a paragraph
    if (nested || p.level !== undefined) {
      // One block. Boundaries go before it when it opens its page, after it otherwise.
      const breaks = nested ? 0 : p.segments.length - 1;
      const before = p.segments[0]!.trim() === "" ? breaks : 0;
      for (let k = 0; k < before; k++) this.newPage();
      this.push(p.level !== undefined ? { level: p.level, text: whole } : { text: whole });
      for (let k = before; k < breaks; k++) this.newPage();
      return;
    }
    p.segments.forEach((segment, k) => {
      if (k > 0) this.newPage();
      this.push({ text: segment });
    });
  }

  openTable(): void {
    this.tables.push({ rows: [], row: null, cell: null, breaks: 0 });
  }

  openRow(): void {
    const t = this.tables[this.tables.length - 1];
    if (t) t.row = [];
  }

  openCell(): void {
    const t = this.tables[this.tables.length - 1];
    if (t) t.cell = [];
  }

  closeCell(): void {
    const t = this.tables[this.tables.length - 1];
    if (!t) return;
    if (t.cell && t.row) t.row.push(t.cell.filter((c) => c !== "").join(" "));
    t.cell = null;
  }

  closeRow(): void {
    const t = this.tables[this.tables.length - 1];
    if (!t) return;
    if (t.row) t.rows.push(t.row);
    t.row = null;
  }

  closeTable(): void {
    const t = this.tables.pop();
    if (!t) return;
    const lines = t.rows.filter((r) => r.some((c) => c !== "")).map((r) => r.join(" | "));
    const parent = this.tables[this.tables.length - 1];
    if (parent?.cell) {
      parent.cell.push(lines.join(" "));
      parent.breaks += t.breaks;
      return;
    }
    this.push({ text: lines.join("\n") });
    for (let k = 0; k < t.breaks; k++) this.newPage();
  }

  private push(block: Block): void {
    this.units[this.units.length - 1]!.blocks.push(block);
  }

  private newPage(): void {
    this.units.push({ kind: "page", blocks: [] });
  }
}
