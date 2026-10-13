/**
 * Dotted names in code that may name a configuration key, and strings that name a
 * Markdown heading: the code half of the code-to-structured edges (Stage 3 of the
 * structured tier).
 *
 * Responsible for one question per syntax node: does this node, on its own, spell
 * a dotted path a structured `key` node could carry? Two shapes qualify. A member
 * chain (`config.app.limits.maxBody`) yields the path after its root binding, and
 * a string literal yields every dotted token inside it (`"bewhole.upload.maxBodyBytes"`).
 *
 * What it deliberately does not do: decide which key a name refers to. That needs
 * the whole repository's key set and lives in `resolve-structured.ts`, so the
 * extraction cache can replay these names unchanged when a config file moves.
 *
 * The non-obvious thing: a chain is read where it is maximal, and a chain that is
 * the callee of a call yields its object instead, so `cfg.items.filter(f)` names
 * `items` (one segment, ignored) and never `items.filter`. Comments are not code
 * and are never scanned. Only TypeScript, JavaScript and Python are wired today;
 * another language joins by adding its node types to the two tables below.
 */
import type Parser from "tree-sitter";
import type { Language } from "./extract.js";

/** Fewest dotted segments a name needs to be looked up as a key path. One segment
 * (`port`, `name`) names something in nearly every config file, so a match on it
 * would be noise, never evidence. */
export const MIN_KEY_REF_SEGMENTS = 2;

/** Member-access node shapes: the node type and the field names of its object and
 * its member, per grammar. */
const MEMBER_ACCESS: Partial<Record<Language, { type: string; object: string; member: string; call: string; memberTypes: ReadonlySet<string> }>> = {
  typescript: { type: "member_expression", object: "object", member: "property", call: "call_expression", memberTypes: new Set(["property_identifier"]) },
  tsx: { type: "member_expression", object: "object", member: "property", call: "call_expression", memberTypes: new Set(["property_identifier"]) },
  python: { type: "attribute", object: "object", member: "attribute", call: "call", memberTypes: new Set(["identifier"]) },
};

/** String-literal content nodes: the text between the quotes, with any template
 * or f-string interpolation already split out by the grammar. */
const STRING_CONTENT: Partial<Record<Language, ReadonlySet<string>>> = {
  typescript: new Set(["string_fragment"]),
  tsx: new Set(["string_fragment"]),
  python: new Set(["string_content"]),
};

/** Root bindings a chain may start from. `this`, `self` and plain identifiers are
 * bindings; anything else (a call result, an index) is not a stable path. */
const ROOT_TYPES: ReadonlySet<string> = new Set(["identifier", "this"]);

/** Wrappers that do not change the path they wrap: TypeScript's `config!.a`. */
const TRANSPARENT_TYPES: ReadonlySet<string> = new Set(["non_null_expression"]);

/** A dotted token inside a string: identifier-like segments joined by dots, not
 * preceded by a path or dot character (so `src/config.json` yields nothing), nor
 * glued to a `#` or `:` (so the id `pkg.json#key:a.b` is not a read of `a.b`),
 * and not followed by more of a path or identifier. */
const DOTTED_TOKEN = /(?<![\w$./\\#:-])[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)+(?![\w$/\\-]|\.[\w$])/g;

/** A whole string that names a heading in a Markdown file: `docs/setup.md#install`. */
const DOC_ANCHOR = /^(?:\.{1,2}\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:md|mdx|markdown)#[\w-]+$/i;

/**
 * The Markdown anchor `node` spells when it is a string literal whose whole text is
 * `<path>.md#<anchor>`, or null. A path inside a longer sentence is not taken: the
 * whole literal is the evidence that the code names the section.
 */
export function docAnchorOf(node: Parser.SyntaxNode, lang: Language): string | null {
  if (!STRING_CONTENT[lang]?.has(node.type)) return null;
  const text = node.text.trim();
  return DOC_ANCHOR.test(text) ? text : null;
}

function same(a: Parser.SyntaxNode | null | undefined, b: Parser.SyntaxNode | null | undefined): boolean {
  return !!a && !!b && a.tree === b.tree && a.id === b.id;
}

/** The segments of a pure member chain, root first, or null when the chain passes
 * through anything but member access (a call, an index, a computed member). */
function chainSegments(node: Parser.SyntaxNode, lang: Language): string[] | null {
  const shape = MEMBER_ACCESS[lang];
  if (!shape) return null;
  const out: string[] = [];
  let cur: Parser.SyntaxNode | null = node;
  while (cur) {
    if (TRANSPARENT_TYPES.has(cur.type)) {
      cur = cur.namedChildren[0] ?? null;
      continue;
    }
    if (cur.type === shape.type) {
      const member = cur.childForFieldName(shape.member);
      if (!member || !shape.memberTypes.has(member.type)) return null;
      out.push(member.text);
      cur = cur.childForFieldName(shape.object);
      continue;
    }
    if (ROOT_TYPES.has(cur.type)) {
      out.push(cur.text);
      return out.reverse();
    }
    return null;
  }
  return null;
}

/**
 * The dotted names `node` itself spells, each with at least MIN_KEY_REF_SEGMENTS
 * segments, for a language this module wires; empty for every other node. Never
 * descends: the extractor's walk visits each node once and calls this on it.
 */
export function keyRefsOf(node: Parser.SyntaxNode, lang: Language): string[] {
  if (STRING_CONTENT[lang]?.has(node.type)) {
    return [...node.text.matchAll(DOTTED_TOKEN)].map((m) => m[0]);
  }
  const shape = MEMBER_ACCESS[lang];
  if (!shape || node.type !== shape.type) return [];
  const isCallee = (n: Parser.SyntaxNode): boolean =>
    n.parent?.type === shape.call && same(n.parent.childForFieldName("function"), n);
  const parent = node.parent;
  const innerOfParent = parent?.type === shape.type && same(parent.childForFieldName(shape.object), node);
  // Read the maximal chain, or one step in when the maximal access is a called
  // method: that is the one place the maximal chain is not a path being read.
  if (innerOfParent ? !isCallee(parent!) : isCallee(node)) return [];
  const segments = chainSegments(node, lang);
  if (!segments) return [];
  const path = segments.slice(1);
  return path.length >= MIN_KEY_REF_SEGMENTS ? [path.join(".")] : [];
}
