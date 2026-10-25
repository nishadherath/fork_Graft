/**
 * The concept listing never mistakes a leftover root card for a concept node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readNodes } from "../src/context/node-file.js";

test("concepts: a root card for a file that left the wiring is not listed as a concept", () => {
  const out = mkdtempSync(join(tmpdir(), "graft-cards-concepts-"));
  try {
    // A card for a file without an extension, left behind by a tier that was switched off.
    writeFileSync(join(out, "Dockerfile.md"), "# Dockerfile\n\n- build · task · L23-L38 — FROM node:22 AS build\n");
    writeFileSync(join(out, "tsconfig.md"), "# tsconfig.json\n\n- strict · key · L3-L3 — strict = true\n");
    writeFileSync(join(out, "empty.md"), "# Makefile\n\n_No extracted symbols in this file._\n");
    writeFileSync(join(out, "notes.md"), "# Notes\n\nHand-written prose.\n");
    assert.deepEqual(readNodes(out).map((n) => n.slug), ["notes"]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
