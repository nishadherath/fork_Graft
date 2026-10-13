/**
 * Resolve structured-tier references ({@link RawEdge.ref}) against the finished
 * node set: the cross-type edges between code, documents and configuration.
 *
 * Responsible for turning a name an extractor recorded (a dotted key path read in
 * code, a Markdown link, a path a program names) into the one node it names, or
 * into nothing. Called from `resolveEdges`
 * for every raw edge that carries a `ref`, after every file has been extracted,
 * because the target usually lives in another file.
 *
 * What it deliberately does not do: guess. The precision rule is `resolve.ts`'s:
 * a unique match is an edge, an ambiguous or absent one is dropped. A wrong edge
 * is worse than none, since `blast` and `ask` both trust what is here.
 *
 * The non-obvious thing: a key path is matched as written or with its file's root
 * segment removed, never as a deeper suffix. Code commonly holds one namespace of
 * a config file (`config = pkg.bewhole`, then `config.upload.maxBodyBytes`), and
 * that one step is the whole allowance; `limits.maxBody` does not match
 * `app.server.limits.maxBody`.
 */
import { posix } from "node:path";
import type { EdgeV1, NodeV1 } from "./types.js";
import type { RawEdge } from "./extract.js";
import { MIN_KEY_REF_SEGMENTS } from "./code-refs.js";

/** The lookups every structured reference resolves against, built once per build. */
export interface StructuredIndex {
  /** A dotted path as code may spell it → the key nodes it could name. */
  keysByPath: Map<string, NodeV1[]>;
  /** Every node id, for file and section targets. */
  ids: ReadonlySet<string>;
}

export interface StructuredHit {
  id: string;
  confidence: EdgeV1["confidence"];
}

/** Index the finished node set for {@link resolveStructuredRef}. */
export function indexStructured(nodes: readonly NodeV1[]): StructuredIndex {
  const keysByPath = new Map<string, NodeV1[]>();
  for (const n of nodes) {
    if (n.kind !== "key") continue;
    // Array indices and quoted segments (`steps[3]`, `a["b.c"]`) are not spelled
    // as a plain dotted path in code, so they are not looked up as one.
    if (n.name.includes("[")) continue;
    const segments = n.name.split(".");
    if (segments.length >= MIN_KEY_REF_SEGMENTS) push(keysByPath, n.name, n);
    if (segments.length - 1 >= MIN_KEY_REF_SEGMENTS) push(keysByPath, segments.slice(1).join("."), n);
  }
  return { keysByPath, ids: new Set(nodes.map((n) => n.id)) };
}

/**
 * The node a structured reference names, or null when nothing in the repository
 * matches or more than one node does. A link a document states is `extracted`, like
 * an import; a key path or a path whose base is a guess is `inferred`.
 */
export function resolveStructuredRef(e: RawEdge, index: StructuredIndex): StructuredHit | null {
  switch (e.ref) {
    case "key": {
      if (!e.name) return null;
      const candidates = index.keysByPath.get(e.name) ?? [];
      return candidates.length === 1 ? { id: candidates[0]!.id, confidence: "inferred" } : null;
    }
    case "link": {
      if (e.specifier === undefined) return null;
      const { path, anchor } = splitTarget(e.specifier);
      const file = path === "" ? e.file : inRepo(path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(e.file), path));
      if (file === null || !index.ids.has(file)) return null;
      return { id: sectionOrFile(file, anchor, index), confidence: "extracted" };
    }
    case "path": {
      if (!e.specifier) return null;
      const { path, anchor } = splitTarget(e.specifier);
      if (path === "") return null;
      const file = uniqueFile(path, e.file, index);
      return file === null ? null : { id: sectionOrFile(file, anchor, index), confidence: "inferred" };
    }
    default:
      return null;
  }
}

/** `a/b.md#x?y` → path `a/b.md`, anchor `x`. Percent-escapes are decoded; a
 * malformed one leaves the text as written rather than failing the build. */
function splitTarget(target: string): { path: string; anchor: string } {
  const hash = target.indexOf("#");
  const rawPath = (hash < 0 ? target : target.slice(0, hash)).replace(/\?.*$/, "").replaceAll("\\", "/");
  const rawAnchor = hash < 0 ? "" : target.slice(hash + 1);
  const decode = (s: string): string => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return { path: decode(rawPath), anchor: decode(rawAnchor).toLowerCase() };
}

/** A repo-relative posix path, or null when it climbs out of the repository. */
function inRepo(path: string): string | null {
  const p = posix.normalize(path);
  return p === ".." || p.startsWith("../") || p === "." ? null : p.replace(/^\.\//, "");
}

/** The section of `file` an anchor names, else the file itself. GitHub numbers a
 * repeated heading's anchor `-1`, `-2`, where this tier mints `~2`, `~3`. */
function sectionOrFile(file: string, anchor: string, index: StructuredIndex): string {
  if (anchor === "") return file;
  const exact = `${file}#section:${anchor}`;
  if (index.ids.has(exact)) return exact;
  const repeat = /^(.*)-(\d+)$/.exec(anchor);
  if (repeat) {
    const nth = `${file}#section:${repeat[1]}~${Number(repeat[2]) + 1}`;
    if (index.ids.has(nth)) return nth;
  }
  return file;
}

/** The one file a base-less path can mean: beside the naming file, or from the
 * repository root. `./x` and `../x` are relative by their own spelling and `/x`
 * is root-relative; two different existing candidates are ambiguous. */
function uniqueFile(path: string, from: string, index: StructuredIndex): string | null {
  const beside = path.startsWith("/") ? null : inRepo(posix.join(posix.dirname(from), path));
  const atRoot = /^\.\.?\//.test(path) ? null : inRepo(path.replace(/^\/+/, ""));
  const found = new Set([beside, atRoot].filter((p): p is string => p !== null && index.ids.has(p)));
  return found.size === 1 ? [...found][0]! : null;
}

function push<T>(map: Map<string, T[]>, key: string, val: T): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}
