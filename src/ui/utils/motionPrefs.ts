/**
 * Central check for the user's reduced-motion preference.
 *
 * Framer-motion driven shakes/lunges/glitches consult this at trigger time and
 * degrade to simple opacity pulses (or nothing). CSS keyframe FX degrade via
 * `@media (prefers-reduced-motion: reduce)` blocks in index.css — this helper
 * exists for the JS-driven half of the system.
 *
 * The MediaQueryList is created lazily once; `.matches` reflects live changes.
 *
 * TICKET 36 — THE PLAYER'S OVERRIDE, AND WHY IT LIVES HERE
 *
 * Seven components call `prefersReducedMotion()` and none of them cache the result, so putting the
 * override behind this one function is the difference between one edit and seven. `null` means "no
 * override" and the OS decides, which is what everyone who never opens the settings screen gets.
 *
 * The CSS half cannot be reached from JavaScript, so `applySettings` stamps
 * `data-reduced-motion="on" | "off"` on `<html>` and the stylesheets guard on it beside their
 * existing media queries. Two mechanisms, one decision — the settings module sets both in the same
 * call so they cannot come apart.
 */
let reducedMotionQuery: MediaQueryList | null | undefined;

/** `null` = defer to the OS. `true`/`false` = the player said so, and outranks the OS. */
let override: boolean | null = null;

export function prefersReducedMotion(): boolean {
    if (override !== null) return override;

    if (reducedMotionQuery === undefined) {
        reducedMotionQuery =
            typeof window !== 'undefined' && typeof window.matchMedia === 'function'
                ? window.matchMedia('(prefers-reduced-motion: reduce)')
                : null;
    }
    return reducedMotionQuery?.matches ?? false;
}

/** Set (or with `null`, clear) the player's override. Called by `settings.applySettings`. */
export function setReducedMotionOverride(value: boolean | null): void {
    override = value;
}

/** What the override currently is, for the settings screen and for tests. */
export function getReducedMotionOverride(): boolean | null {
    return override;
}
