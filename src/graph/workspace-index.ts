/**
 * The workspace index: the small, dependency-light half of workspace federation.
 *
 * Owns the `graft/workspace.json` format and its readers and writers. It does
 * not load graphs, rank, or run any federated command; those live in
 * `workspace.ts`, which re-exports everything here so existing imports keep
 * working. It is a separate module so the code that only asks "is this a
 * workspace?" (the CLI at startup, `root.ts`) does not load the builder, the
 * ranker and the checkers that `workspace.ts` needs.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contextDirFor } from "../context/node-file.js";
import { discoverWorkspaceChildren } from "./scopes.js";
import { wiringPath } from "./write.js";

/** The parent index written to `<parent>/graft/workspace.json`. Nodes/edges
 * never live at the parent — they live in each child's own `graft/`. */
export interface WorkspaceV1 {
  version: 1;
  /** Immediate child dir names that are git repos, sorted. */
  children: string[];
}

const WORKSPACE_FILE = "workspace.json";

/** Absolute path to the workspace index for a parent root (`<dir>/graft/workspace.json`). */
export function workspacePath(root: string, override?: string): string {
  return join(contextDirFor(root, override), WORKSPACE_FILE);
}

/** Read the workspace index, or null when the parent has none (not a workspace,
 * or unparseable/foreign json — treated the same as absent). */
export function readWorkspace(root: string, override?: string): WorkspaceV1 | null {
  const path = workspacePath(root, override);
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<WorkspaceV1>;
    if (parsed.version !== 1 || !Array.isArray(parsed.children)) return null;
    return { version: 1, children: parsed.children.map(String) };
  } catch {
    return null;
  }
}

/** Write the workspace index, sorting children for a stable, minimal git diff. */
export function writeWorkspace(root: string, ws: WorkspaceV1, override?: string): string {
  const dir = contextDirFor(root, override);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, WORKSPACE_FILE);
  const sorted: WorkspaceV1 = { version: 1, children: [...ws.children].sort() };
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
  return path;
}

/** A parent is a workspace BUILD target when it has no own `.git` and ≥2 git
 * children — or it was already split (a `workspace.json` is present). The
 * no-own-`.git` guard keeps a normal repo with git submodules from being
 * mistaken for a workspace. */
export function isWorkspaceBuildRoot(root: string, override?: string): boolean {
  if (readWorkspace(root, override)) return true;
  if (existsSync(join(root, ".git"))) return false;
  return discoverWorkspaceChildren(root).length >= 2;
}

/** True when the parent has a mega-graph from an older single-graph build
 * (`graft/.graph/wiring.json`) — the thing a workspace build migrates away. */
export function hasMegaGraph(root: string, override?: string): boolean {
  return existsSync(wiringPath(contextDirFor(root, override)));
}

/** The EXACT split warning printed once, when a mega-graph parent is first
 * built as a workspace. Templated on the child list so it names the real repos. */
export function migrationNote(children: string[]): string {
  const dirs = children.map((c) => `${c}/graft/`).join(", ");
  return (
    `⚠ this folder contains ${children.length} separate git repos — splitting: ` +
    `each repo now gets its own committable graft/ (${dirs}); the combined graph ` +
    `here is replaced by a workspace index. Queries from here now search all repos, fairly.`
  );
}

/** Remove the parent's entire `graft/` tree — the mega-graph, its `.cache`, and
 * any stale cards — so after `writeWorkspace` the parent holds ONLY
 * workspace.json. Child graphs live in sibling `<child>/graft/`, never under
 * this dir, so they are untouched. */
export function clearParentGraft(root: string, override?: string): void {
  rmSync(contextDirFor(root, override), { recursive: true, force: true });
}
