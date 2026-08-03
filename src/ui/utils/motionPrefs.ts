/**
 * Central check for the user's reduced-motion preference.
 *
 * Framer-motion driven shakes/lunges/glitches consult this at trigger time and
 * degrade to simple opacity pulses (or nothing). CSS keyframe FX degrade via
 * `@media (prefers-reduced-motion: reduce)` blocks in index.css — this helper
 * exists for the JS-driven half of the system.
 *
 * The MediaQueryList is created lazily once; `.matches` reflects live changes.
 */
let reducedMotionQuery: MediaQueryList | null | undefined;

export function prefersReducedMotion(): boolean {
    if (reducedMotionQuery === undefined) {
        reducedMotionQuery =
            typeof window !== 'undefined' && typeof window.matchMedia === 'function'
                ? window.matchMedia('(prefers-reduced-motion: reduce)')
                : null;
    }
    return reducedMotionQuery?.matches ?? false;
}
