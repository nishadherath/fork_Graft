// Module-loader hook used by startup-imports.test.ts: appends every URL the
// loader resolves to the file named by GRAFT_RESOLVE_LOG, one per line.
import { appendFileSync } from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  appendFileSync(process.env.GRAFT_RESOLVE_LOG, `${resolved.url}\n`);
  return resolved;
}
