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
 * 3. **Nothing is a gate.** No tip blocks input, and every tip carries both "Got it" and "Skip
 *    tips". A tutorial you cannot leave is the first thing a returning player resents.
 * 4. **The predicate is the honesty.** A tip whose moment cannot be detected cheaply does not ship;
 *    see `battle:endturn`'s note for the one place that changed what the tip says.
 *
 * Full tutorialization is re-cut after ticket 25's playtest — this is the floor, not the design.
 *
 * Engine code: no React, no Redux, no imports from `src/ui` or `src/debug`.
 */

import { ElementalMatrix } from './combatUtils';
import { GetProgramData } from './data/programRegistry';
import type { Element, IBattleEntity, IBattleState } from './types';
import type { IRunState } from './runTypes';

// ---------------------------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------------------------

/**
 * Every tip id, as a closed union.
 *
 * The `surface:subject` shape is deliberate: `seenTips` is a flat string array on the save (it has
 * to be — zod, and a set is not JSON), so the id is the only thing that says where a stored entry
 * came from. `ALL_TIP_IDS` below is what "Skip tips" writes, so a new id is opted into the skip by
 * existing here and nowhere else.
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
    | 'ranch:blueprints';

export interface Tip {
    readonly id: TipId;
    /** Four or five words. It is a label on a strip, not a heading. */
    readonly title: string;
    /** One or two sentences, in the player's terms. Never names a file, a type or a ticket. */
    readonly body: string;
}

/**
 * The five fight tips, in the order a first fight teaches them.
 *
 * The ticket asks for "energy, play a card, STAB, end turn, the type chart". The order here is not
 * that list's order: **the type chart comes before END TURN**, because the matchup is a thing you
 * want to know while you still have energy to act on it, and END TURN is the last thing that
 * happens in a turn. The set is the ticket's; the sequence is the turn's.
 */
const BATTLE_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'battle:energy',
        title: 'Energy is per mingming',
        body:
            'Each of your mingmings has its own energy, shown as pips under its name, and each one ' +
            'refills at the start of your turn. A card is paid for by whoever casts it.',
    },
    {
        id: 'battle:play',
        title: 'Pick a caster, then a card',
        body:
            'Click one of your mingmings to select it, then click a card and click a target. The ' +
            'numbers on the card face are what will actually happen — for that caster, on that target.',
    },
    {
        id: 'battle:stab',
        title: 'Matching elements hit harder',
        body:
            'A card whose element matches its caster deals x1.5. The hand outlines those cards for ' +
            'whoever you have selected, so the outline moves when you change caster.',
    },
    {
        id: 'battle:matchup',
        title: 'Elements beat elements',
        body:
            'On top of that, the attacker\'s element is weighed against the defender\'s. Hover any ' +
            'element badge to see what it beats and what beats it.',
    },
    {
        id: 'battle:endturn',
        title: 'End turn refills everyone',
        body:
            'There is no reason to hold energy back — it does not carry over. When you are out of ' +
            'plays worth making, END TURN, and everyone starts full again.',
    },
];

/** The three map tips. `map:types` is what makes the map a decision rather than a corridor. */
const MAP_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'map:types',
        title: 'The map tells you first',
        body:
            'Every node says what is in it before you step on it — the fight, the shop, the ' +
            'workshop. You can see one layer ahead, so a route is something you choose, not something ' +
            'you find out about.',
    },
    {
        id: 'map:gym',
        title: 'The gym is the run',
        body:
            'The last node of the third biome is the gym: three fights back to back with no healing ' +
            'in between. Everything before it is preparation for it.',
    },
    {
        id: 'map:workshop',
        title: 'Workshops grow the team',
        body:
            'A workshop is where you recruit a second and then a third mingming, and each one brings ' +
            'its own cards into the shared deck. Recruiting is drafting.',
    },
];

const RANCH_TIPS: ReadonlyArray<Tip> = [
    {
        id: 'ranch:blueprints',
        title: 'Blueprints are what you keep',
        body:
            'A run takes its scrap and its cards with it when it ends. Blueprints do not — they come ' +
            'back here, and they are what you spend to assemble a new mingming for the next run.',
    },
];

/** Every tip, by id. */
export const TIP_REGISTRY: ReadonlyMap<TipId, Tip> = new Map(
    [...BATTLE_TIPS, ...MAP_TIPS, ...RANCH_TIPS].map((tip) => [tip.id, tip]),
);

/** What "Skip tips" writes into `seenTips`. Adding a tip above adds it here. */
export const ALL_TIP_IDS: ReadonlyArray<TipId> = [...TIP_REGISTRY.keys()];

/** The one ranch tip, by name, so `RanchScreen` does not index a list by number. */
export const RANCH_BLUEPRINT_TIP: Tip = RANCH_TIPS[0];

/**
 * The tip whose presence in `seenTips` means "this player has been taught a fight".
 *
 * `RunStart` reads it to decide `createRun`'s `onboarding` flag. It is the FIRST battle tip
 * specifically because that is the only one with no condition on it — every other tip waits for a
 * moment (a STAB card in hand, a non-neutral matchup) that a given fight may never produce, so
 * "seen" for any of those would be a claim about the fight rather than about the player.
 */
export const FIRST_BATTLE_TIP_ID: TipId = BATTLE_TIPS[0].id;

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

/** Does any living player member share an element with any card in hand? (`None` never STABs.) */
function handCanStab(state: IBattleState): boolean {
    const mine = new Set<Element>();
    for (const entity of living(state.playerParty)) {
        for (const element of elementsOf(entity)) if (element !== 'None') mine.add(element);
    }
    if (mine.size === 0) return false;

    for (const card of state.playerDeck.hand) {
        const data = GetProgramData(card.dataId);
        if (data.element !== 'None' && mine.has(data.element)) return true;
    }
    return false;
}

/**
 * Is there a non-neutral matchup on the field right now?
 *
 * Reads `ElementalMatrix` rather than a copy of it, for the reason `TypeChart.getMatchupMultiplier`
 * gives: a second table is a table that can disagree with combat.
 */
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
            case 'battle:energy':
            case 'battle:play':
                return tip;
            case 'battle:stab':
                if (handCanStab(state)) return tip;
                continue;
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
            default:
                continue;
        }
    }
    return null;
}

function workshopIsAdjacent(run: IRunState): boolean {
    const current = run.nodes.find((node) => node.id === run.currentNodeId);
    if (!current) return false;
    return current.edges.some(
        (id) => run.nodes.find((node) => node.id === id)?.kind === 'workshop',
    );
}
