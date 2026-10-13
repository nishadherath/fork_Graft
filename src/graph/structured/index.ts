/**
 * Structured tier: documents and configuration as addressable units.
 *
 * Where the depth, container and breadth tiers turn code into functions and
 * classes, this tier turns Markdown into `section` nodes (one per heading) and
 * JSON, YAML, TOML and INI into `key` nodes (one per dotted key path). Each unit
 * carries an exact line span in the host file, so `graft ask --source` prints it
 * verbatim and the cards, skeleton and grep need no change to show it.
 *
 * Opt-in (`graft build --structured`, or `GRAFT_STRUCTURED=1`), decision D1. The
 * choice is persisted in `.graft/config.json` and read through
 * `readStructured` (util/state.ts), so the build, the freshness probe, `check`
 * and the automatic refresh always enumerate the same files.
 *
 * Markdown and TOML are hand-written line scanners; JSON, YAML and INI parse
 * with the wasm grammars bundled in `tree-sitter-wasm` (decision D2). All are
 * deterministic, keyless and cached by content hash like every other tier.
 *
 * Not here: edges between documents and code (a later stage), and anything that
 * needs a converter dependency. Lockfiles are never indexed: they are large,
 * machine-written and carry no unit worth locating.
 */
import { basename } from "node:path";
import { loadWasmLanguage } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { extractCss } from "./css.js";
import { extractGradle } from "./gradle.js";
import { extractHtml } from "./html.js";
import { extractIni } from "./ini.js";
import { extractJson } from "./json.js";
import { extractMake } from "./make.js";
import { extractMarkdown } from "./markdown.js";
import { extractToml } from "./toml.js";
import { extractCmake, extractDockerfile } from "./targets.js";
import { extractXml } from "./xml.js";
import { extractYaml } from "./yaml.js";
import { structuredFileNode } from "./shared.js";

export type StructuredFamily = "markdown" | "json" | "yaml" | "toml" | "ini" | "css" | "html" | "xml" | "gradle" | "make" | "dockerfile" | "cmake";

/** A structured-tier language: graft name, family (which extractor), the file
 * extensions it claims, and the wasm basename when a bundled grammar parses it. */
export interface StructuredLang {
  name: string;
  family: StructuredFamily;
  exts: string[];
  wasm?: string;
}

/** The structured registry. Extensions must not collide with another tier's;
 * `test/structured-tier.test.ts` pins that. Dot-files and dot-directories
 * (`.editorconfig`, `.github/workflows/`) are never walked (ingest/fs.ts), so no
 * extension here can reach them. */
export const STRUCTURED_LANGS: readonly StructuredLang[] = [
  { name: "markdown", family: "markdown", exts: [".md", ".markdown", ".mdx"] },
  { name: "json", family: "json", exts: [".json", ".jsonc", ".jsonl"], wasm: "json" },
  { name: "yaml", family: "yaml", exts: [".yaml", ".yml"], wasm: "yaml" },
  { name: "toml", family: "toml", exts: [".toml"] },
  { name: "ini", family: "ini", exts: [".ini", ".cfg"], wasm: "ini" },
  { name: "css", family: "css", exts: [".css"], wasm: "css" },
  { name: "scss", family: "css", exts: [".scss"], wasm: "scss" },
  { name: "html", family: "html", exts: [".html", ".htm"], wasm: "html" },
  { name: "svelte", family: "html", exts: [".svelte"], wasm: "svelte" },
  { name: "astro", family: "html", exts: [".astro"], wasm: "astro" },
  // No wasm: the bundled xml grammar crashes on every input here, see xml.ts.
  { name: "gradle", family: "gradle", exts: [".gradle"] },
  { name: "make", family: "make", exts: ["makefile", ".mk"] },
  // Matched as path suffixes, so "Dockerfile", "api.dockerfile" and "CMakeLists.txt" all land.
  { name: "dockerfile", family: "dockerfile", exts: ["dockerfile"], wasm: "dockerfile" },
  { name: "cmake", family: "cmake", exts: ["cmakelists.txt", ".cmake"], wasm: "cmake" },
  { name: "xml", family: "xml", exts: [".xml", ".plist", ".storyboard", ".xib", ".entitlements"] },
];

/** Machine-written lockfiles that share a structured extension. Large, noisy and
 * of no use as a locator, so they are excluded by name whatever flag is set. */
const LOCKFILE_NAMES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
]);

const byExt = new Map<string, StructuredLang>();
for (const l of STRUCTURED_LANGS) for (const e of l.exts) byExt.set(e, l);

/** The structured language for a path, or null if none claims it (or it is a
 * lockfile). Extension match is case-insensitive. */
export function structuredLangOf(path: string): StructuredLang | null {
  const lower = path.toLowerCase().replaceAll("\\", "/");
  if (LOCKFILE_NAMES.has(basename(lower))) return null;
  for (const [ext, l] of byExt) if (lower.endsWith(ext)) return l;
  return null;
}

/** Every file extension the structured tier claims. */
export function structuredExtensions(): string[] {
  return STRUCTURED_LANGS.flatMap((l) => l.exts);
}

const loaded = new Map<string, unknown>();

/** Grammars a language needs beyond its own: Markdown reads its front matter as
 * YAML, and a page reads its <style> blocks as CSS. */
const ALSO_NEEDS: Readonly<Record<string, readonly string[]>> = {
  markdown: ["yaml"],
  html: ["css"],
  svelte: ["css"],
  astro: ["css"],
};

/** Warm the wasm grammars the given structured languages need. Same contract as
 * `warmGenericGrammars`: await once before the synchronous parse loop. An
 * unavailable grammar is skipped, and its files then extract to a file node only. */
export async function warmStructuredGrammars(langNames: Iterable<string>): Promise<void> {
  const wanted = new Set<string>();
  for (const name of langNames) {
    wanted.add(name);
    for (const extra of ALSO_NEEDS[name] ?? []) wanted.add(extra);
  }
  for (const name of wanted) {
    if (loaded.has(name)) continue;
    const row = STRUCTURED_LANGS.find((l) => l.name === name);
    if (!row?.wasm) continue;
    const language = await loadWasmLanguage(row.wasm);
    if (language) loaded.set(name, language);
  }
}

/** Extract one structured file. Synchronous; wasm-backed families need their
 * grammar pre-warmed. Never throws on malformed input: an unparseable document
 * yields a file node and whatever units were recoverable. */
export function extractStructured(rel: string, source: string, lang: StructuredLang): ExtractResult {
  switch (lang.family) {
    case "markdown":
      return extractMarkdown(rel, source, loaded.get("yaml"));
    case "yaml":
      return extractYaml(rel, source, loaded.get(lang.name));
    case "toml":
      return extractToml(rel, source);
    case "ini":
      return extractIni(rel, source, loaded.get(lang.name));
    case "css":
      return extractCss(rel, source, loaded.get(lang.name));
    case "gradle":
      return extractGradle(rel, source);
    case "make":
      return extractMake(rel, source);
    case "dockerfile":
      return extractDockerfile(rel, source, loaded.get(lang.name));
    case "cmake":
      return extractCmake(rel, source, loaded.get(lang.name));
    case "xml":
      return extractXml(rel, source);
    case "html":
      return extractHtml(rel, source, loaded.get(lang.name), loaded.get("css"));
    case "json":
      return extractJson(rel, source, loaded.get(lang.name), rel.toLowerCase().endsWith(".jsonl"));
    default:
      return { nodes: [structuredFileNode(rel, source)], rawEdges: [] };
  }
}
