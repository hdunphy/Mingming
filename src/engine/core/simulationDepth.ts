/**
 * IS THE ENGINE BEING ASKED A QUESTION, OR IS IT PLAYING THE GAME? — ticket 144c.
 *
 * `findBestSequence` drives the real `battleReducer` to score candidate moves: ticket 127 measured
 * **93,889 reducer calls for one 3v3 decision**. Every one of those calls narrates itself into
 * `state.logs`, and every `addLog` is `{ ...state, logs: [...state.logs, message] }` — a fresh copy
 * of an array that grows all battle. So the cost is quadratic in turn count, paid ninety thousand
 * times a decision, to build a transcript of a fight that never happened and that nothing ever
 * reads.
 *
 * This is the same shape as `resolutionStackDepth`, which the engine already keeps for recursion
 * guarding: a module-level counter, incremented around the search's own reducer calls, never
 * persisted and never part of the state. At depth 0 — a real play, in the actual game, or a
 * scenario test — logging behaves exactly as it always has.
 *
 * SAFE BECAUSE NOTHING DOWNSTREAM READS `logs`. `evaluateState` scores HP, statuses and bodies and
 * never touches the field; `cellCache` keys on assemblies; `runBatch` reads outcomes. The logs the
 * PLAYER sees come from real plays. Grepping for a reader before trusting that is the right instinct
 * — do it again if this ever seems to lie.
 *
 * It is a plain counter rather than a boolean because the search can re-enter (a hook resolving a
 * free cast that itself simulates), and a boolean would be reset by the inner exit.
 */
let depth = 0;

/** Enter a simulated play. ALWAYS pair with `endSimulation` in a `finally`. */
export function beginSimulation(): void {
    depth += 1;
}

export function endSimulation(): void {
    depth = depth > 0 ? depth - 1 : 0;
}

/** True while the engine is being driven by the search rather than by a player. */
export function isSimulating(): boolean {
    return depth > 0;
}

/**
 * Test seam. The counter is module state, so a test that throws inside a simulated play would leak
 * a non-zero depth into every later test in the same file and silently mute their logs.
 */
export function resetSimulationDepth(): void {
    depth = 0;
}
