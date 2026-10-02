/**
 * ONBOARDING-LITE — ticket 24. What the game says to a player who has never seen it.
 *
 * # WHY THE TIPS ARE ENGINE CODE AND THE CALLOUT IS NOT
 *
 * A tip has two halves: a sentence, and the moment it is true. The sentence is content; the moment
 * is a predicate over battle or run state. Only the second half can be wrong in a way a player
 * notices — a STAB tip that fires when no card in hand can STAB teaches the wrong lesson twice
 * (once about STAB, once about whether the game is paying attention). So the predicates live here,
 * pure, next to the state they read, and `<Callout>` is left with nothing to decide.
 *
 * That split is also the only way this is testable. `renderToStaticMarkup` runs no effects and there
 * is no `@testing-library/react` in this repo, so **a tip's appearance cannot be driven from a
 * test** — you cannot click "Got it" and re-render. What CAN be tested exhaustively is
 * `nextBattleTip` / `nextMapTip` against hand-built states, and that is where `tips.test.ts` puts
 * its weight.
 *
 * # THE RULES, SUCH AS THEY ARE
 *
 * 1. **One at a time.** Each surface asks for the *first unseen tip whose moment has arrived*, in a
 *    fixed order. Five callouts stacked on a first fight is not onboarding, it is a EULA.
 * 2. **Once ever, not once per run.** `seenTips` lives on the ranch save (`IRanchState`), so the
 *    lesson survives the run that taught it — a player who dies in biome 0 does not get taught
 *    energy again on the next attempt.
 * 3. **Nothing is a gate.** No tip blocks input, and none carries a button: since ticket 182a a
 *    tip is a one-line toast (`<Callout>`) that goes away by itself or on the next click. A toast
 *    does not need skipping, and a tutorial you cannot leave is the first thing a returning player
 *    resents.
 * 4. **The predicate is the honesty.** A tip whose moment cannot be detected cheaply does not ship;
 *    see `battle:endturn`'s note for the one place that changed what the tip says.
 * 5. **Three fight tips are retired (ticket 182a).** `battle:energy`, `battle:play` and `battle:stab`
 *    are no longer in the order: a first fight teaches them by being played. Their ids stay in
 *    `TipId` so a save that holds them still parses.
 *
 * Full tutorialization is re-cut after ticket 25's playtest — this is the floor, not the design.
 *
 * Engine code: no React, no Redux, no imports from `src/ui` or `src/debug`.
 */

import { ElementalMatrix } from './combatUtils';
import type { Element, IBattleEntity, IBattleState } from './types';
import type { IRunState, NodeKind } from './runTypes';

// ---------------------------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------------------------

/**
 * Every tip id, as a closed union.
 *
 * The `surface:subject` shape is deliberate: `seenTips` is a flat string array on the save (it has
 * to be — zod, and a set is not JSON), so the id is the only thing that says where a stored entry
 * came from. `ALL_TIP_IDS` below lists every tip that can still be shown. Three fight ids
 * (`battle:energy`, `battle:play`, `battle:stab`) are retired by ticket 182a: they stay in this union
 * so an old save's `seenTips` parses, but they are no longer in the registry.
 */
export type TipId =
    | 'battle:energy'
    | 'battle:play'
    | 'battle:stab'
    | 'battle:matchup'
    | 'battle:endturn'
    | 'map:types'
    | 'map:gym'
    | 'map:workshop'
    | 'map:rival'
    | 'map:scout'
    | 'ranch:blueprints';

export interface Tip {
    readonly id: TipId;
    /** Four or five words. It is a label on a strip, not a heading. */
    readonly title: string;
    /** One or two sentences, in the player's terms. Never names a file, a type or a ticket. */
    readonly body: string;
}

/**
 * The two fight tips, in the order a first fight teaches them (ticket 182a cut it from five).
 *
 * The matchup comes before END TURN, because it is a thing you want to know while you still have
 * energy to act on it, and END TURN is the last thing that happens in a turn.
 */
const BATTLE_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'battle:matchup',
        title: 'Elements beat elements',
        body: 'Elements beat elements; hover a badge to see how.',
    },
    {
        id: 'battle:endturn',
        title: 'End turn refills everyone',
        body: 'Energy refills every turn, so spend it, then END TURN.',
    },
];

/** The three map tips. `map:types` is what makes the map a decision rather than a corridor. */
const MAP_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'map:types',
        title: 'The map tells you first',
        body: 'Every node shows what is inside it, one layer ahead.',
    },
    {
        id: 'map:gym',
        title: 'The gym is the run',
        body: 'The last node is the gym: three fights in a row.',
    },
    {
        id: 'map:workshop',
        title: 'Workshops grow the team',
        body: 'A workshop adds a mingming and its cards to your team.',
    },
    {
        id: 'map:rival',
        title: 'A rival brings the other element',
        body: 'Rivals field the element this road needs; beat one for its blueprint.',
    },
    {
        id: 'map:scout',
        title: 'The scout is the leader',
        body: 'The last fight before the gym previews the leader\'s team.',
    },
];

const RANCH_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'ranch:blueprints',
        title: 'Blueprints are what you keep',
        body: 'Blueprints are what you keep after a run, and what builds new mingmings.',
    },
];

/** Every tip, by id. */
export const TIP_REGISTRY: ReadonlyMap<TipId, Tip> = new Map(
    [...BATTLE_TIPS, ...MAP_TIPS, ...RANCH_TIPS].map((tip) => [tip.id, tip]),
);

/** Every tip that can still be shown. Adding a tip above adds it here. */
export const ALL_TIP_IDS: ReadonlyArray<TipId> = [...TIP_REGISTRY.keys()];

/** The one ranch tip, by name, so `RanchScreen` does not index a list by number. */
export const RANCH_BLUEPRINT_TIP: Tip = RANCH_TIPS[0];

/*
 * `FIRST_BATTLE_TIP_ID` lived here until 2026-08-23. `RunStart` read it to decide whether a run got
 * an easier first fight, which coupled the difficulty of your opening encounter to whether you had
 * pressed "Skip tips". Henry cut the coupling: every run's opening fight is easy now
 * (`encounter.isOpeningFight`), so nothing outside this module needs to ask what the tips know.
 */

// ---------------------------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------------------------

/** A `seenTips` list, as it is stored: order-insensitive, may contain ids this build removed. */
export type SeenTips = ReadonlyArray<string>;

const isSeen = (seen: SeenTips, id: TipId): boolean => seen.includes(id);

const living = (party: ReadonlyArray<IBattleEntity>): IBattleEntity[] =>
    party.filter((entity) => entity.currentHp > 0);

const elementsOf = (entity: IBattleEntity): Element[] =>
    entity.secondaryElement
        ? [entity.primaryElement, entity.secondaryElement]
        : [entity.primaryElement];

function fieldHasMatchup(state: IBattleState): boolean {
    for (const attacker of living(state.playerParty)) {
        for (const defender of living(state.enemyParty)) {
            for (const a of elementsOf(attacker)) {
                for (const d of elementsOf(defender)) {
                    if ((ElementalMatrix[a]?.[d] ?? 1) !== 1) return true;
                }
            }
        }
    }
    return false;
}

/**
 * The next fight tip to show, or `null`.
 *
 * Only ever fires on the player's own turn: a callout that appears while the enemy is acting reads
 * as a reaction to what the enemy just did.
 *
 * **`battle:endturn`'s moment is "you have played a card", not "you cannot afford anything".** The
 * honest predicate for the second one is `getEffectiveCardCost` over every (card, caster) pair,
 * which runs the cost pipeline including firmware — real work, on every render, to answer a question
 * that is already answered on screen by the greyed-out cards. So the tip fires after the first play
 * instead, and its text was rewritten to match what that moment actually teaches: energy does not
 * carry over. A tip whose sentence is true whenever it appears beats a tip that waits for the
 * perfect instant and costs a cost calculation to find it.
 */
export function nextBattleTip(state: IBattleState, seen: SeenTips): Tip | null {
    if (state.activeSide !== 'PLAYER') return null;

    for (const tip of BATTLE_TIPS) {
        if (isSeen(seen, tip.id)) continue;
        switch (tip.id) {
            case 'battle:matchup':
                if (fieldHasMatchup(state)) return tip;
                continue;
            case 'battle:endturn':
                if (state.cardsPlayedThisTurn > 0) return tip;
                continue;
            default:
                continue;
        }
    }
    return null;
}

/**
 * The next map tip, or `null`.
 *
 * `map:workshop` waits until a workshop is **one step away**, which is the only one of the three
 * that is genuinely contextual — every biome has exactly one (`REGION_PARAMS.guaranteedMiddleKinds`),
 * so "there is a workshop somewhere" would be true from the first frame and would teach nothing
 * about where.
 */
export function nextMapTip(run: IRunState, seen: SeenTips): Tip | null {
    for (const tip of MAP_TIPS) {
        if (isSeen(seen, tip.id)) continue;
        switch (tip.id) {
            case 'map:types':
            case 'map:gym':
                return tip;
            case 'map:workshop':
                if (workshopIsAdjacent(run)) return tip;
                continue;
            // Ticket 142c: contextual for `map:workshop`'s reason, and more so. A rival is one wild
            // in three, so "there are rivals" is true from the first frame and teaches nothing about
            // WHICH node; adjacency is what makes the sentence about the thing on screen.
            case 'map:rival':
                if (kindIsAdjacent(run, 'rival')) return tip;
                continue;
            case 'map:scout':
                if (scoutIsAdjacent(run)) return tip;
                continue;
            default:
                continue;
        }
    }
    return null;
}

function workshopIsAdjacent(run: IRunState): boolean {
    return kindIsAdjacent(run, 'workshop');
}

/** Whether a node of `kind` is one step from where the player is standing. */
function kindIsAdjacent(run: IRunState, kind: NodeKind): boolean {
    return adjacentNodes(run).some((node) => node.kind === kind);
}

/**
 * Ticket 142c: the scout is not a KIND — it is a flag on an ordinary fight node, because it takes
 * over whatever the last pre-gauntlet fight was. So it needs its own predicate rather than another
 * `kindIsAdjacent` call, and this is the first thing in the UI layer to read `node.scout` at all.
 */
function scoutIsAdjacent(run: IRunState): boolean {
    return adjacentNodes(run).some((node) => node.scout === true);
}

function adjacentNodes(run: IRunState) {
    const current = run.nodes.find((node) => node.id === run.currentNodeId);
    if (!current) return [];
    return current.edges
        .map((id) => run.nodes.find((node) => node.id === id))
        .filter((node): node is NonNullable<typeof node> => node !== undefined);
}
