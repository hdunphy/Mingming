/**
 * WHICH BUILD IS THIS? — ticket 181a.
 *
 * Friends-and-family playtesters report bugs against whatever the page said, and the page used to say
 * `ALPHA v0.3.5` forever, so a bug report could not name its build. The label and the commit are
 * injected at BUILD time (`vite.config.ts` `define`): the label from the env var `VITE_BUILD_LABEL`
 * (the deploy workflow sets it from the repository variable `PLAYTEST_LABEL`), the commit from
 * `git rev-parse --short HEAD`.
 *
 * Two defaults, so a local build is never mistaken for a release: no env var reads `dev`, and a
 * build with no git reads `unknown`.
 *
 * TICKET 181e adds the game's VERSION, `major.minor.patch`, read at build time from `package.json`
 * (the only place it is written) as `__GAME_VERSION__`. A release bumps it, so the label a tester
 * quotes reads `PLAYTEST 2 · v0.4.0 · <commit>`.
 *
 * The constants are read behind `typeof`, so a tool that imports this file without Vite's `define`
 * (a bare Node script) gets the defaults instead of a ReferenceError.
 */

declare const __BUILD_LABEL__: string | undefined;
declare const __BUILD_COMMIT__: string | undefined;
declare const __GAME_VERSION__: string | undefined;

export interface BuildInfo {
    readonly label: string;
    /** `major.minor.patch`, from `package.json` (ticket 181e). */
    readonly version: string;
    readonly commit: string;
}

export const DEFAULT_BUILD_LABEL = 'dev';
export const UNKNOWN_BUILD_COMMIT = 'unknown';
/** What a build with no version constant reads (a bare Node import): `package.json`'s old placeholder. */
export const DEFAULT_GAME_VERSION = '0.0.0';

/** A missing, empty or blank value falls back to its default. */
export function resolveBuildInfo(label?: string | null, commit?: string | null, version?: string | null): BuildInfo {
    return {
        label: label?.trim() || DEFAULT_BUILD_LABEL,
        version: version?.trim() || DEFAULT_GAME_VERSION,
        commit: commit?.trim() || UNKNOWN_BUILD_COMMIT,
    };
}

/** The text a player reads, and a bug report quotes: `PLAYTEST 2 · v0.4.0 · 5557bbb`. */
export function buildText(info: BuildInfo): string {
    return `${info.label} · v${info.version} · ${info.commit}`;
}

export const BUILD_INFO: BuildInfo = resolveBuildInfo(
    typeof __BUILD_LABEL__ === 'undefined' ? undefined : __BUILD_LABEL__,
    typeof __BUILD_COMMIT__ === 'undefined' ? undefined : __BUILD_COMMIT__,
    typeof __GAME_VERSION__ === 'undefined' ? undefined : __GAME_VERSION__,
);
