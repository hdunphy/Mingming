/**
 * THE CODEX — ticket 31. What the collection contains, and what counts as having it.
 *
 * # ZERO POWER ATTACHED, AND WHAT THAT COSTS THIS MODULE
 *
 * `economy-session.md`: *"Card collection = a CODEX (seen/played cards logged; completion pays
 * cosmetics or blueprints) — collection as achievement layer, **ZERO power attached**."* That is a
 * standing constraint on the whole feature, and it decides the shape here: nothing in this file
 * returns a bonus, a stat, a discount or a drop. It answers one question — *how much of the game
 * have you met?* — and the answer is a count.
 *
 * # THE FIVE LEDGERS, AND WHY THEY ARE NOT ONE
 *
 * `ICodex` grew from two lists to five. Each is a different claim about the player, and collapsing
 * any two of them would lose a distinction that cannot be recovered afterwards:
 *
 * - `seen` — a card was **on screen**: in a deck the run held at the end (ticket 19's teardown), or
 *   played by either side in a fight. Superset of `played`.
 * - `played` — the player **cast** it. Not the enemy casting it at you; `useCodexRecorder` checks
 *   the caster's side, because "I have played Maelstrom" and "Maelstrom has been played at me" are
 *   different achievements and only one of them is yours.
 * - `species` — a mingming was **on the field**, yours or the enemy's. This is the bestiary.
 * - `assembled` — you **built one**, at the ranch, out of a blueprint. Strict subset of `species`.
 * - `os` — a firmware was **equipped** on something you own (at assembly, or through a swap).
 *
 * # WHAT COMPLETION IS MEASURED AGAINST
 *
 * The denominators are derived from the registries at call time rather than written down, for the
 * reason `TypeChart.getMatchupMultiplier` gives about the element matrix: a second copy of a count
 * is a count that can disagree. Two of them need a deliberate filter, and both filters are
 * arguments rather than conveniences — see `codexTargets`.
 *
 * Engine code: no React, no Redux, no imports from `src/ui` or `src/debug`.
 */

import { LAUNCH_SPECIES, MingmingRegistry, PLAYABLE_SPECIES } from './data/mingmingRegistry';
import { ProgramRegistry } from './data/programRegistry';
import type { ICodex } from './runTypes';

// ---------------------------------------------------------------------------------------------
// What there is to collect
// ---------------------------------------------------------------------------------------------

/**
 * Every card the codex counts.
 *
 * **Tokens are excluded, and that is the filter with an argument behind it.** `programs.json` holds
 * 216 entries, four of which are `rarity: 'Token'` (`hoof_strike`, `feedback_token`,
 * `sky_burial_risen`, `sky_burial_ascended`). A token is generated mid-battle by another card; it
 * is never drafted, bought, owned or chosen. Counting them would make 100% depend on having drawn
 * the right generator at the right moment, which is a completion the player cannot pursue.
 *
 * So the codex's denominator is **212**, and the tokens still record if they are played — they just
 * do not make the target harder to reach.
 */
export function codexCardIds(): string[] {
    // `isToken`, not `rarity === 'Token'`: the data carries "Token" in its rarity column but the
    // `Rarity` union does not admit it, so the flag is the typed question and the string is a
    // coincidence of the JSON.
    return Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].isToken !== true);
}

/**
 * Every species the codex counts: `PLAYABLE_SPECIES`, which is the registry minus the control.
 *
 * `MingmingRegistry` holds 17 entries and one of them (`control`) exists only as a balance-harness
 * baseline — `mingmingRegistry` says out loud that anything player-facing must enumerate through
 * `PLAYABLE_SPECIES` "or the control shows up as a wild Mingming". A codex is player-facing.
 *
 * The narrower `LAUNCH_SPECIES` (6) is what Early Access actually ships; it is exported below as
 * `codexLaunchSpeciesIds` so a screen can show "6 of 6 at launch" beside "6 of 16 eventually"
 * without either number pretending to be the other.
 */
export function codexSpeciesIds(): string[] {
    return [...PLAYABLE_SPECIES];
}

export function codexLaunchSpeciesIds(): string[] {
    return [...LAUNCH_SPECIES];
}

/**
 * Every firmware the codex counts, derived by inverting `IMingmingDefinition.availableOS`.
 *
 * **Not** `Object.keys(FIRMWARE_REGISTRY)`, for two reasons. It is lazily populated — it is empty
 * until something calls `getOSBehavior`, so enumerating it directly is a race with whatever else
 * the app happened to do first. And it contains the three `boss_relic_*` signatures (ticket 18),
 * which are gym-boss firmware the player can never equip: counting them would make the codex
 * permanently incompletable by three.
 */
export function codexOsIds(): string[] {
    const ids: string[] = [];
    for (const species of PLAYABLE_SPECIES) {
        for (const os of MingmingRegistry[species]?.availableOS ?? []) {
            if (!ids.includes(os)) ids.push(os);
        }
    }
    return ids;
}

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

export interface CodexLine {
    /** Stable id, used as a react key and by the milestone predicates. */
    readonly id: CodexTrack;
    readonly label: string;
    /** How many of `total` are recorded. Never exceeds `total` — see the note below. */
    readonly held: number;
    readonly total: number;
}

export type CodexTrack = 'cards-seen' | 'cards-played' | 'species' | 'assembled' | 'os';

/**
 * The five progress lines.
 *
 * **`held` is intersected with the target list rather than taken as a length**, and that is
 * load-bearing rather than defensive: the ledgers are add-only and never pruned (a recorded entry
 * that could disappear would make completion a moving target), so a save that recorded a token, a
 * retired card id or the control species keeps it forever. Counting the raw array would then report
 * 213 of 212. Intersecting means the codex can hold more than it counts, which is the honest way
 * round.
 */
export function codexProgress(codex: ICodex): CodexLine[] {
    const cards = codexCardIds();
    const species = codexSpeciesIds();
    const os = codexOsIds();

    const count = (held: ReadonlyArray<string>, target: ReadonlyArray<string>): number => {
        const set = new Set(held);
        return target.filter((id) => set.has(id)).length;
    };

    return [
        { id: 'cards-seen', label: 'Cards seen', held: count(codex.seen, cards), total: cards.length },
        { id: 'cards-played', label: 'Cards played', held: count(codex.played, cards), total: cards.length },
        { id: 'species', label: 'Species met', held: count(codex.species, species), total: species.length },
        { id: 'assembled', label: 'Species assembled', held: count(codex.assembled, species), total: species.length },
        { id: 'os', label: 'Firmware equipped', held: count(codex.os, os), total: os.length },
    ];
}

/** A whole-number percentage, floored, so "99%" never means "finished". */
export function codexPercent(line: CodexLine): number {
    if (line.total === 0) return 0;
    return Math.floor((line.held / line.total) * 100);
}

// ---------------------------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------------------------

/**
 * A completion milestone: a threshold on one track, and — eventually — what it pays.
 *
 * # THE PAYOUTS ARE DELIBERATELY UNWIRED, AND THIS IS THE FLAG
 *
 * The ticket says *"completion milestones paying cosmetics or blueprints (**Henry numbers**)"*, and
 * it means it: what a milestone pays is an economy decision, not an implementation one. Two things
 * make guessing actively bad here rather than merely presumptuous:
 *
 * - **Blueprints are the only persistent currency in the game.** A codex that pays them is a codex
 *   that pays *power*, which is the one thing `economy-session.md` forbids it — unless the amounts
 *   are chosen against the same anchor the rest of the economy was derived from. That is a ruling.
 * - **Cosmetics do not exist.** There is no cosmetic system, no registry, nothing to pay with.
 *
 * So `reward` is `null` on every entry and the machinery around it is complete: milestones are
 * detected, recorded once, and shown as achieved. **Wiring a payout is one field per row plus one
 * dispatch in `useCodexRecorder`** — the shape is here waiting for the numbers.
 */
export interface CodexMilestone {
    readonly id: string;
    readonly label: string;
    readonly track: CodexTrack;
    /** Fraction of the track's total, 0-1. `1` means "all of it". */
    readonly fraction: number;
    /** `null` until Henry rules. See the docblock. */
    readonly reward: null;
}

/**
 * The ladder.
 *
 * Quarter steps on the two card tracks and the bestiary, and completion on the two that are small
 * enough to actually finish. The *shape* is the claim being made — that completion is worth
 * marking at all — and the fractions are placeholders in the same sense the payouts are: cheap to
 * retune, because they are fractions of a live denominator rather than hardcoded counts.
 */
export const CODEX_MILESTONES: ReadonlyArray<CodexMilestone> = [
    { id: 'codex:cards-seen:25', label: 'A quarter of the cards seen', track: 'cards-seen', fraction: 0.25, reward: null },
    { id: 'codex:cards-seen:50', label: 'Half the cards seen', track: 'cards-seen', fraction: 0.5, reward: null },
    { id: 'codex:cards-seen:100', label: 'Every card seen', track: 'cards-seen', fraction: 1, reward: null },
    { id: 'codex:cards-played:25', label: 'A quarter of the cards played', track: 'cards-played', fraction: 0.25, reward: null },
    { id: 'codex:cards-played:50', label: 'Half the cards played', track: 'cards-played', fraction: 0.5, reward: null },
    { id: 'codex:cards-played:100', label: 'Every card played', track: 'cards-played', fraction: 1, reward: null },
    { id: 'codex:species:50', label: 'Half the bestiary met', track: 'species', fraction: 0.5, reward: null },
    { id: 'codex:species:100', label: 'The whole bestiary met', track: 'species', fraction: 1, reward: null },
    { id: 'codex:assembled:100', label: 'One of every species assembled', track: 'assembled', fraction: 1, reward: null },
    { id: 'codex:os:100', label: 'Every firmware equipped', track: 'os', fraction: 1, reward: null },
];

/**
 * Which milestones the codex currently satisfies.
 *
 * Pure, and computed from the ledgers rather than stored, so it cannot drift from them. What IS
 * stored is which ones have *fired* (`IRanchState.codexMilestones`) — because firing is an event
 * that pays out once, and "currently satisfied" would pay again every time the screen mounted.
 */
export function milestonesMet(codex: ICodex): string[] {
    const byTrack = new Map(codexProgress(codex).map((line) => [line.id, line]));
    return CODEX_MILESTONES.filter((milestone) => {
        const line = byTrack.get(milestone.track);
        if (!line || line.total === 0) return false;
        return line.held >= Math.ceil(line.total * milestone.fraction);
    }).map((milestone) => milestone.id);
}

/** Milestones satisfied but not yet recorded — what a recorder should fire. */
export function milestonesToFire(codex: ICodex, fired: ReadonlyArray<string>): string[] {
    const already = new Set(fired);
    return milestonesMet(codex).filter((id) => !already.has(id));
}
