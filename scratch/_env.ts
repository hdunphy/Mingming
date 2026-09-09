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

/**
 * The real process environment, or `{}` where there is no process.
 *
 * **IT IS EMPTY UNDER vite-node TODAY, AND THAT IS WHY THIS THROWS.** The computed-key reach was
 * meant to dodge `vite.config.ts`'s `define: { 'process.env': {} }`. It does not: measured
 * 2026-09-09, `Object.keys(process.env).length` inside a vite-node script is **0**, so every
 * instrument that reads `ENV.DECK` has been silently running its DEFAULT deck and printing a
 * perfectly plausible result for the wrong thing. That is the ticket-114 failure this file's own
 * header describes, reproduced by the very guard written to prevent it.
 *
 * So reading a missing key is now a THROW rather than `undefined`. The header's own argument is
 * the justification: a required flag "would have caught the re-baseline bug on its first lane
 * instead of its thirty-first". Every env-based run line in this folder is ALREADY broken; this
 * only decides whether it breaks loudly. `arg()` below works, and is the fix for each script.
 *
 * A caller that genuinely wants "unset is fine" reads `ENV_RAW` instead.
 */
export const ENV_RAW: Record<string, string | undefined> =
    ((globalThis as unknown as Record<string, Record<string, Record<string, string | undefined>>>)
        .process?.[ENV_PROP] ?? {}) as Record<string, string | undefined>;

/** True when the substitution has blanked the environment, which is the only case that throws. */
const ENV_IS_EMPTY = Object.keys(ENV_RAW).length === 0;

export const ENV: Record<string, string | undefined> = new Proxy(ENV_RAW, {
    get(target, key): string | undefined {
        if (typeof key !== 'string') return undefined;
        const value = target[key];
        if (value === undefined && ENV_IS_EMPTY) {
            throw new Error(
                `${key}: the environment is EMPTY under vite-node - vite.config.ts substitutes ` +
                `\`process.env\` with {} - so \`ENV.${key}\` cannot be read, and this script ` +
                `would otherwise have silently run its DEFAULT (the ticket-114 dead-arm failure). ` +
                `Pass a flag instead: \`npx vite-node <script> -- --${key.toLowerCase()} <value>\`, ` +
                `and switch the script to \`arg('${key.toLowerCase()}')\`.`,
            );
        }
        return value;
    },
});

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
