/**
 * Configuration access for the scratch instruments, in a form Vite's `define` cannot rewrite.
 *
 * THE PROBLEM. `vite.config.ts` sets `define: { 'process.env': {} }` so a stray env read cannot
 * throw in the browser bundle. That substitution is textual and fires on everything Vite
 * transforms, which includes every file in this folder when it is loaded through vite-node. A plain
 * `process.env.ITER` here becomes `({}).ITER` - undefined - and the script silently runs its
 * defaults.
 *
 * That is not hypothetical. The ticket-114 re-baseline measured `draugr_v2` eleven times over under
 * whatever deck name the parent asked for, because `gridshard.ts` read its deck from the
 * environment. The CSV looked entirely plausible: 330 rows, sensible win rates, a field average.
 * Nothing errored. This is the dead-arm failure mode applied to the whole toolkit at once, which is
 * why it is worth a shared module rather than a fix per script.
 *
 * THE RULE THIS RESPECTS. `vite.config.ts` states the convention: "every debug CLI in this repo
 * takes flags rather than environment variables". `arg()` below is that, and new instruments should
 * use it. `ENV` exists because sixty-odd existing scripts document env-based run lines in their own
 * headers, and rewriting all of those invocations is a bigger change than the bug warrants - the
 * REASON for the rule is that the browser bundle has no Node environment, and nothing in `scratch/`
 * is ever bundled for the browser.
 *
 * Reaching the object off `globalThis` by a computed key leaves no `process.env` token for the
 * define to match, and yields `{}` anywhere `process` does not exist.
 */

const ENV_PROP = 'env';

/** The real process environment, or `{}` where there is no process. */
export const ENV: Record<string, string | undefined> =
    ((globalThis as unknown as Record<string, Record<string, Record<string, string | undefined>>>)
        .process?.[ENV_PROP] ?? {}) as Record<string, string | undefined>;

/**
 * A command-line flag, `--name value`. Prefer this in new instruments.
 *
 * Omitting `dflt` makes the flag REQUIRED and throws when it is missing, which is the behaviour
 * that would have caught the re-baseline bug on its first lane instead of its thirty-first.
 */
export function arg(name: string, dflt?: string): string {
    const argv = ((globalThis as unknown as { process?: { argv?: string[] } }).process?.argv) ?? [];
    const i = argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`${name}: --${name} is required`);
        return dflt;
    }
    return v;
}

/** A flag if present, else the environment, else the default. Bridges the two conventions. */
export function cfg(name: string, dflt?: string): string {
    const argv = ((globalThis as unknown as { process?: { argv?: string[] } }).process?.argv) ?? [];
    if (argv.indexOf(`--${name}`) !== -1) return arg(name, dflt);
    return ENV[name] ?? ENV[name.toUpperCase()] ?? (dflt ?? (() => {
        throw new Error(`${name}: pass --${name} or set ${name.toUpperCase()}`);
    })());
}
