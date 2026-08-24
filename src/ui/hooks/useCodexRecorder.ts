import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { milestonesToFire } from '../../engine/codex';
import { globalBattleEventBus } from '../../engine/events';
import { recordCodex, recordCodexMilestones } from '../store/gameSlice';
import type { RootState } from '../store/store';

/**
 * THE CODEX'S IN-BATTLE HALF — ticket 31.
 *
 * # WHY THE EVENT BUS AND NOT THE ACTION TAP
 *
 * The ticket suggests *"logged from the reducer via an `ActionTap`-style middleware — the seam
 * exists in `store.ts`"*. It does, and it is the wrong seam here, for three reasons found while
 * looking:
 *
 * 1. **The slot is taken and it is a slot, not a list.** `setActionTap` is documented "last caller
 *    wins" and the debug action tape holds it. A production consumer installing itself would
 *    silently disable the tape, and mounting the debug panel would silently disable the codex.
 * 2. **`battle/playProgram` carries the card's INSTANCE id, not its dataId.** A middleware would
 *    have to look the instance up in the pre-dispatch hand to learn what card it was — and the card
 *    is gone from the hand by the time the action lands.
 * 3. **The action is intent; the event is fact.** `handlePlayProgram` can fizzle *after* the cost is
 *    paid (the caster dies paying) and returns without emitting. A middleware would count that play.
 *
 * `PROGRAM_PLAYED` (`engine/events.ts`) carries the **dataId**, is emitted only where a play
 * actually resolved, and — the part that matters most — **is not emitted at all while the bus is
 * muted**. `TacticalAI` runs whole speculative card sequences through the real reducer to score
 * them, muted; so does every damage preview. A counter inside the reducer would record the AI's
 * imagination. Subscribing to the bus gets that filter for free, which `statusCensus.ts` calls the
 * "0-AI-SIM-COUNTS predicate".
 *
 * # WHAT IT RECORDS
 *
 * - Every resolved play → `seen` (a card that was cast was on screen, whoever cast it).
 * - A play by one of **your** party → `played`. The bestiary distinction: "I have played Maelstrom"
 *   and "Maelstrom has been played at me" are different achievements and only one is yours.
 * - Every species on the field when a battle starts → `species`. Both sides, because the enemy is
 *   visibly standing there; this is the bestiary, not a roster.
 *
 * Deliberately **not** recorded: the enemy's whole deck at battle start. It would be a claim that
 * the player saw cards the fight may never have shown them.
 *
 * The other two ledgers (`assembled`, `os`) are written by the ranch reducers themselves — see
 * `gameSlice.assembleMingming`, which is where they cannot be forgotten.
 *
 * # MILESTONES
 *
 * Recomputed from the ledgers whenever they change and fired once. `milestonesToFire` compares
 * "currently satisfied" against "already fired", so the effect is idempotent and a remount cannot
 * re-fire anything. **The payouts are unwired pending Henry's numbers** (`CodexMilestone`); when
 * they land, this is the one place that pays them.
 */
export function useCodexRecorder(): void {
    const dispatch = useDispatch();
    const battle = useSelector((state: RootState) => state.battle.battle);
    const codex = useSelector((state: RootState) => state.game.codex);
    const fired = useSelector((state: RootState) => state.game.codexMilestones);

    // --- Cards, from resolved plays -----------------------------------------------------------
    //
    // Subscribed once for the life of the app rather than per battle: the bus is a module
    // singleton, a battle can start and end without this component re-rendering, and an
    // unsubscribe/resubscribe cycle per fight is a window in which a play could be missed.
    useEffect(() => {
        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            if (event.type !== 'PROGRAM_PLAYED') return;
            const dataId = event.programId;
            if (!dataId) return;

            // `store.getState()` is deliberately not used: the listener fires synchronously inside
            // the reducer, so the selector's captured `battle` is the same state the play resolved
            // against. Whether the caster is yours cannot change mid-play.
            const isPlayer = battle?.playerParty.some((entity) => entity.id === event.sourceId) ?? false;
            const payload = isPlayer ? { seen: [dataId], played: [dataId] } : { seen: [dataId] };

            /*
             * THE DISPATCH IS DEFERRED BECAUSE THE LISTENER IS INSIDE A REDUCER — reported
             * 2026-08-24, and it broke every card play in the game.
             *
             * `emit` runs synchronously from `resolutionEngine.applyMutations`, which runs inside
             * `battleSlice.playProgram`, which is a reducer. Redux forbids dispatching there and
             * throws "You may not call store.getState() while the reducer is executing". That throw
             * unwound back out through `applyMutations` and the engine reducer, so `state.battle`
             * was never reassigned — while `useBattleVfx`, subscribed to the same bus and called
             * first, had already fired the hit animation and the damage number. The play looked like
             * it landed and then wasn't there: no discard, no damage, full HP on both sides.
             *
             * A microtask is the smallest correct seam. It runs as soon as the current call stack
             * empties — after the reducer has returned and the dispatch has completed, and still
             * before any timer, paint or user input — so the codex is written in the same frame the
             * card resolved in, from outside the reducer. Everything the entry depends on (`dataId`,
             * `isPlayer`) is read synchronously above, so a later state change cannot alter it.
             *
             * NOT fixed by wrapping `emit` in a try/catch: a listener that cannot do its job should
             * say so loudly, and swallowing this would have hidden the same defect behind a codex
             * that silently recorded nothing.
             */
            queueMicrotask(() => dispatch(recordCodex(payload)));
        });
        return unsubscribe;
    }, [dispatch, battle]);

    // --- Species, from the field ---------------------------------------------------------------
    //
    // Keyed on `sessionId` so this fires once per battle rather than once per state change. A
    // mid-battle summon would be missed; nothing summons a mingming today, and recording the field
    // every reducer tick to catch a hypothetical would cost a dedupe pass per action.
    const sessionId = battle?.sessionId;
    useEffect(() => {
        if (!battle || sessionId === undefined) return;
        const species = [...battle.playerParty, ...battle.enemyParty].map((entity) => entity.definitionId);
        if (species.length > 0) dispatch(recordCodex({ species }));
        // `battle` is intentionally not a dependency — see the note above on `sessionId`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, sessionId]);

    // --- Milestones ----------------------------------------------------------------------------
    useEffect(() => {
        const toFire = milestonesToFire(codex, fired);
        if (toFire.length > 0) dispatch(recordCodexMilestones(toFire));
    }, [dispatch, codex, fired]);
}
