/**
 * TICKET 163g — **WHICH patch, and the two the gate offers.** Ranked by what a patch is WORTH.
 *
 * Split from `patchRegistry.ts`, which holds the six transforms themselves. The reason is a real
 * import cycle rather than housekeeping: ranking needs `debug/balance/powerscale`, and
 * `powerscale → core/Hooks → core/entityHooks → patchRegistry` closes the loop. `entityHooks` needs
 * the transforms and never needs the ranking, so the two halves separate cleanly along exactly that
 * line. **Anything that APPLIES a patch imports `patchRegistry`; anything that CHOOSES one imports
 * this file.**
 *
 * # WHY THE RANKING CHANGED
 *
 * 163d shipped `patchTouchCount` — how many of a firmware's hooks a rider changes at all — as an
 * explicit stand-in for 163 §3's scored delta. **163e measured what that produced: `amplifier ×27`,
 * every patch the walker fitted across sixty runs.** Amplifier touches an `amount` field and nearly
 * every hook has one, so it won the count on every body before any question of worth arose. A
 * ranking whose answer is the same on all twelve is not a ranking, and Henry ruled it out on
 * 2026-09-25: *"rank by the 149c-scored delta (host hook value after − before), which is §3 as
 * written."*
 */
import { patchScoreDelta, type HookRecord } from '../../debug/balance/powerscale';
import { PATCHES, PATCH_IDS, patchTouchCount, type PatchDefinition, type PatchId } from './patchRegistry';
import type { DataHookDefinition, ModifierDataHookDefinition } from '../core/HookTypes';

type AnyHook = DataHookDefinition | ModifierDataHookDefinition;

/**
 * What a patch is WORTH to this firmware — ticket 163g, and 163 §3 as it was always written.
 *
 * The host's 149c hook value after the transform minus before it, in percent of a health pool per
 * game. `patchScoreDelta` prices both sides with the same function at the same measured rates, so
 * everything the scorer cannot see cancels and what is left is the part the patch changed.
 *
 * Re-exported here rather than imported at three call sites because "how good is this patch on
 * this body" is a question about patches, and the ranking below has to be the same answer the
 * offer screen and the walker get.
 */
export function patchScoreDeltaFor(patch: PatchDefinition, hooks: ReadonlyArray<AnyHook>): number {
    return patchScoreDelta(
        hooks as ReadonlyArray<HookRecord>,
        (hook) => patch.apply(hook as AnyHook) as HookRecord,
    );
}

/**
 * TICKET 163d — **the patch this body would get the most out of.** 161 §2's seeding rule, applied
 * to patches: *"the host body's best patch in that run's pool."*
 *
 * # TICKET 163g REPLACED THE RANKING, AND THE OLD ONE RANKED BY CONSTRUCTION
 *
 * "Best" was `patchTouchCount` — how many of the firmware's hooks the rider changes at all —
 * shipped in 163d as an explicit stand-in for 163 §3's scored delta. **163e then measured what it
 * produced: `amplifier ×27`, which is every patch the walker fitted in sixty runs.** Amplifier
 * touches an `amount` field and nearly every hook has one, so it won a count on every body before
 * any question of worth. A ranking whose answer is the same on all twelve is not a ranking.
 *
 * "Best" is now **the 149c-scored delta** (`patchScoreDeltaFor`), which is what §3 asked for:
 * *"a Relay on a self-only OS scores high and on an ally-reading OS scores zero."* That sentence
 * is about VALUE, and a count cannot express it — Relay's count is 1 either way.
 *
 * `patchTouchCount` stays, and not as a leftover: a delta of 0 does not say whether the rider found
 * nothing to change or changed something worth nothing, and the offer screen needs to tell those
 * apart. It is also the TIE-BREAK below, which matters more than it sounds — see the next note.
 *
 * OVERCLOCK CAN NEVER WIN THIS EITHER, and it is now honest about why. Its touch count is zero by
 * construction (it changes no hook; it changes what a scaler counts), so its delta is zero too. The
 * difference is that a zero delta is now a STATEMENT — this scorer cannot see what Overclock does —
 * rather than an artefact of the metric. It reaches the player through the doors that do not rank:
 * the gate's choice of two, and the shop.
 *
 * Ties break on touch count and then on declaration order, so the answer is stable for a given
 * firmware and a re-roll is a re-roll rather than a coin flip.
 */
export function bestPatchFor(hooks: ReadonlyArray<AnyHook>): PatchDefinition {
    return [...PATCH_IDS]
        .map((id) => PATCHES[id])
        .reduce((best, patch) => (rankKey(patch, hooks) > rankKey(best, hooks) ? patch : best), PATCHES.amplifier);
}

/**
 * One patch's rank against one firmware: **scored delta first, touch count as the tie-break.**
 *
 * The tie-break is doing real work rather than decorating the sort. Five of the six riders can
 * come out at a delta of exactly 0 on a body whose hooks the scorer cannot price — an unmeasured
 * proc rate contributes 0 to both terms — and in that case the count is the only signal left that
 * the rider fits at all. Without it the shelf would fall back to declaration order, which is
 * Amplifier again, by a different route.
 *
 * Scaled rather than lexicographic because a sort needs one number: the count is worth a hundredth
 * of a point, which is the delta's own rounding unit, so it can never outrank a real difference.
 */
function rankKey(patch: PatchDefinition, hooks: ReadonlyArray<AnyHook>): number {
    return patchScoreDeltaFor(patch, hooks) + patchTouchCount(patch, hooks) / 100;
}

/**
 * The patch the shop always stocks — §3: *"AMPLIFIER is the boring one every OS can take and is
 * the workshop's default stock."*
 *
 * Named rather than spelled at the call site so the shop and the ticket say the same word.
 */
export const SHOP_STOCK_PATCH: PatchId = 'amplifier';

/**
 * The gate's CHOICE OF TWO (163 §3's "where"), for one body.
 *
 * The body's best first, then the best of the rest — so the choice always includes the one that
 * fits. A pair drawn at random would routinely offer two patches that do nothing to this firmware,
 * which is a choice in form only.
 *
 * # TICKET 163g: THE TWO MUST BE TWO DIFFERENT KINDS
 *
 * Henry, 2026-09-25. Ranked alone, the top two are frequently the same KIND of rider — two
 * `amount` patches, say — because a firmware that rewards one amount-patch rewards the other, and
 * then the "choice" is which of two versions of the same idea to take. `PatchDefinition.field` is
 * already the kind (163 §4's list, carried as data precisely so it can be grouped on), so the
 * second offer is **the best patch whose `field` differs from the first's**.
 *
 * The fallback when no second kind is available is the next-best patch of any kind, rather than a
 * single offer: one offer is not a choice, and a shelf that sometimes shows one row and sometimes
 * two would read as a bug. With six patches across six distinct fields this fallback is currently
 * unreachable; it is written because "currently" is a fact about the table, not about this rule.
 */
export function gatePatchChoices(hooks: ReadonlyArray<AnyHook>, held: ReadonlyArray<string>): PatchId[] {
    const ranked = PATCH_IDS
        .filter((id) => !held.includes(id))
        .sort((a, b) => rankKey(PATCHES[b], hooks) - rankKey(PATCHES[a], hooks));
    if (ranked.length < 2) return ranked.slice(0, 2);

    const first = ranked[0];
    const second = ranked.slice(1).find((id) => PATCHES[id].field !== PATCHES[first].field) ?? ranked[1];
    return [first, second];
}
