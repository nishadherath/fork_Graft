/**
 * Resolve structured-tier references ({@link RawEdge.ref}) against the finished
 * node set: the cross-type edges between code, documents and configuration.
 *
 * Responsible for turning a name an extractor recorded (a dotted key path read in
 * code) into the one node it names, or into nothing. Called from `resolveEdges`
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
import type { EdgeV1, NodeV1 } from "./types.js";
import type { RawEdge } from "./extract.js";
import { MIN_KEY_REF_SEGMENTS } from "./code-refs.js";

/** The lookups every structured reference resolves against, built once per build. */
export interface StructuredIndex {
  /** A dotted path as code may spell it → the key nodes it could name. */
  keysByPath: Map<string, NodeV1[]>;
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
  return { keysByPath };
}

/**
 * The node a structured reference names, or null when nothing in the repository
 * matches or more than one node does. Every hit is `inferred`: a name equal to a key
 * path is strong evidence, not a declared import.
 */
export function resolveStructuredRef(e: RawEdge, index: StructuredIndex): StructuredHit | null {
  switch (e.ref) {
    case "key": {
      if (!e.name) return null;
      const candidates = index.keysByPath.get(e.name) ?? [];
      return candidates.length === 1 ? { id: candidates[0]!.id, confidence: "inferred" } : null;
    }
    default:
      return null;
  }
}

function push<T>(map: Map<string, T[]>, key: string, val: T): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}
