/**
 * Crash report — what the error screen hands the player so a white-screen bug becomes a
 * reproducible one.
 *
 * Ticket 04 (steam-release map) asked for this to "reuse `debug/snapshotIO.ts`'s export shape".
 * It reuses the *shape*, deliberately not the *module*: `src/debug/` is DEV-only, nothing outside
 * it may import it, and `scripts/assert-no-debug.mjs` fails the build if the toolkit reaches
 * `dist/`. An import here would take the whole toolkit into every shipped bundle. So the envelope
 * below mirrors snapshotIO's — a stamped wrapper with a generated `name`, a `version`, a
 * `createdAt` and the payload underneath — and shares nothing but that convention.
 *
 * Pure by design, like snapshotIO's split: `buildCrashReport()` is testable headlessly and
 * `copyCrashReport()` is the thin clipboard half.
 */

/** Bumped when the envelope's own fields change, not when the payload's do. */
export const CRASH_REPORT_VERSION = 1;

export interface CrashReportInput {
    error: unknown;
    /** React's `componentStack` from `componentDidCatch`'s second argument, when available. */
    componentStack?: string;
    /** Redux state at the moment of the throw. Serialized best-effort; see `safeSerialize`. */
    state?: unknown;
    /** Injectable for tests. Defaults to `new Date().toISOString()`. */
    now?: () => string;
    /** Injectable for tests. Defaults to `navigator.userAgent` when a navigator exists. */
    userAgent?: string;
}

export interface CrashReport {
    name: string;
    version: number;
    createdAt: string;
    userAgent?: string;
    error: {
        name: string;
        message: string;
        stack?: string;
    };
    componentStack?: string;
    state?: unknown;
    /** Set when `state` could not be serialized, so a truncated report is still obviously partial. */
    stateError?: string;
}

/** `Error`-ish, a string, or something that fell out of a `throw {}`. Never throws. */
function describeError(error: unknown): CrashReport['error'] {
    if (error instanceof Error) {
        return { name: error.name, message: error.message, stack: error.stack };
    }
    if (typeof error === 'string') {
        return { name: 'Error', message: error };
    }
    try {
        return { name: 'Error', message: JSON.stringify(error) ?? String(error) };
    } catch {
        return { name: 'Error', message: String(error) };
    }
}

/**
 * `crash-<epoch-ish timestamp>-<first 8 chars of the message>`. Same spirit as
 * `snapshotName()`: greppable, unique enough, and generated without asking the player anything —
 * the moment a run just died is the worst possible moment for a dialog.
 */
export function crashReportName(error: unknown, createdAt: string): string {
    const stamp = createdAt.replace(/[^0-9]/g, '').slice(0, 14) || 'unknown';
    const slug = describeError(error).message.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toLowerCase() || 'nomessage';
    return `crash-${stamp}-${slug}`;
}

/**
 * Redux state holds `Map`s, class instances and (under the debug toolkit) circular references.
 * A crash report that itself throws while being built is worse than a partial one, so this
 * degrades instead: on failure the caller gets `stateError` and no `state`.
 */
function safeSerialize(state: unknown): { value?: unknown; error?: string } {
    if (state === undefined) return {};
    try {
        return { value: JSON.parse(JSON.stringify(state)) };
    } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
    }
}

/** Pure. Never throws — a builder that can fail is useless in a catch block. */
export function buildCrashReport(input: CrashReportInput): CrashReport {
    const createdAt = (() => {
        try {
            return (input.now ?? (() => new Date().toISOString()))();
        } catch {
            return 'unknown';
        }
    })();

    const serialized = safeSerialize(input.state);

    const report: CrashReport = {
        name: crashReportName(input.error, createdAt),
        version: CRASH_REPORT_VERSION,
        createdAt,
        error: describeError(input.error),
    };

    const ua = input.userAgent ?? (typeof navigator === 'undefined' ? undefined : navigator.userAgent);
    if (ua) report.userAgent = ua;
    if (input.componentStack) report.componentStack = input.componentStack;
    if (serialized.value !== undefined) report.state = serialized.value;
    if (serialized.error) report.stateError = serialized.error;

    return report;
}

/** Pretty-printed, same two-space indent snapshots use, so the two paste alike into an issue. */
export function serializeCrashReport(report: CrashReport): string {
    try {
        return JSON.stringify(report, null, 2);
    } catch {
        // `report` is built from already-serialized parts, so this is close to unreachable —
        // but a crash handler that throws is the one failure mode that must not exist.
        return JSON.stringify({ name: report.name, version: report.version, error: report.error }, null, 2);
    }
}

/**
 * Clipboard write with a `document.execCommand` fallback: `navigator.clipboard` needs a secure
 * context and is missing in exactly the environments where a crash is most likely to be reported
 * from (file://, an old Electron shell, a page served over plain http on a LAN).
 */
export async function copyCrashReport(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy path
    }

    try {
        if (typeof document === 'undefined') return false;
        const scratch = document.createElement('textarea');
        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.style.position = 'fixed';
        scratch.style.opacity = '0';
        document.body.appendChild(scratch);
        scratch.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(scratch);
        return ok;
    } catch {
        return false;
    }
}
