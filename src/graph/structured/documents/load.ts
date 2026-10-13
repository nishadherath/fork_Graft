/**
 * Lazy loading of the documents tier's optional converter packages.
 *
 * Responsible for: importing `pdfjs-dist` and `fflate` only when a document of
 * their format is actually converted, and turning "the package is not installed"
 * into a {@link MissingConverterError} that names the package (decision D4).
 *
 * Deliberately does not: type the packages' APIs. Each converter narrows the
 * module it receives to the few members it calls, in its own file, so the build
 * compiles whether or not the optional packages are installed.
 */

/** A converter's package is not installed. The message names it and the fix. */
export class MissingConverterError extends Error {
  constructor(readonly packageName: string) {
    super(
      `the optional package ${packageName} is not installed; reinstall graft without --omit=optional, ` +
        `or run \`npm install ${packageName}\` in graft's install directory`,
    );
    this.name = "MissingConverterError";
  }
}

/** True when `err` says the module itself could not be found, as opposed to a
 * module that was found and then failed while loading. */
function isModuleNotFound(err: unknown, specifier: string): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") && err.message.includes(specifier.split("/")[0]!);
}

const loaded = new Map<string, Promise<unknown>>();

/** Import `specifier` from `packageName`, once per process. Throws
 * {@link MissingConverterError} when the package is absent; any other failure is
 * re-thrown with the specifier added. */
export function importOptional(packageName: string, specifier: string): Promise<unknown> {
  let pending = loaded.get(specifier);
  if (!pending) {
    pending = import(specifier).catch((err: unknown) => {
      loaded.delete(specifier);
      if (isModuleNotFound(err, specifier)) throw new MissingConverterError(packageName);
      throw new Error(`loading ${specifier} failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    loaded.set(specifier, pending);
  }
  return pending;
}
