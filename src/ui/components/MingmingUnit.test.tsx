/**
 * SIX ENTITIES, READABLE — ticket 22.
 *
 * Two of the ticket's four clauses land on this component, and both are about a 3v3 board being a
 * different problem from a 1v1 one rather than a bigger one:
 *
 * 1. **Per-member energy must be legible at six entities on a 1280×800 frame.** Six units each
 *    spending Energy independently is the state a 3v3 turn is planned against, and a proportional
 *    6px bar does not answer "how many can I still cast" for any of them. Pips do. The fit is
 *    arithmetic rather than taste — see `ENERGY_PIP_BUDGET`'s docblock and the matching sums on
 *    `.hud-energy-pips` in `index.css` — and what this file pins is that the arithmetic is actually
 *    obeyed: six cards render, the pip count is the Energy, and the row never silently disappears.
 * 2. **Target validity must be obvious, and an invalid target must SAY WHY.** Tickets 13, 14 and 20
 *    set that convention and `MacroRack` states it outright: a silently inert control is
 *    indistinguishable from a bug. With one unit a side the only illegal drop was discovered by
 *    making it; with six the question is asked six ways at once.
 *
 * Rendered to static markup, the shape the panel tests established — no `@testing-library/react`,
 * and a lockfile change is forbidden in this repo. `renderToStaticMarkup` runs no effects, so the
 * hover-portal tooltips are out of reach here; that is why every verdict this file asserts is
 * rendered unconditionally into the card rather than hidden behind a hover.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import MingmingUnit, { ENERGY_PIP_BUDGET } from './MingmingUnit';
import type { Element, IBattleEntity, IBattleState } from '../../engine/types';

/** Enemy-only: one ATTACK action, `target: 'Single'`, no HEAL or STATUS to open the ally carve-out. */
const ENEMY_ONLY_CARD = 'fire_punch_v2';
/** Ally-only: `target: 'Self'`, so pointing it at an enemy has to be refused with a sentence. */
const SELF_ONLY_CARD = 'all_in';

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name: id.toUpperCase(),
        definitionId: 'test_def',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 200, currentHp: 200,
        cardDraw: 3, maxEnergy: 3, currentEnergy: 3,
        attack: 45, defense: 30, speed: 10,
        primaryElement: 'None' as Element, secondaryElement: 'None' as Element,
        tempHp: 0, statusEffects: [], daemons: [], hooks: [],
        playsThisTurn: 0,
        ...over,
    } as IBattleEntity;
}

const PLAYERS = [
    unit('p1', { maxEnergy: 3, currentEnergy: 2 }),
    unit('p2', { maxEnergy: 2, currentEnergy: 2 }),
    unit('p3', { maxEnergy: 4, currentEnergy: 0 }),
];
const ENEMIES = [
    unit('e1', { maxEnergy: 3, currentEnergy: 3 }),
    unit('e2', { maxEnergy: 2, currentEnergy: 1 }),
    unit('e3', { maxEnergy: 1, currentEnergy: 1 }),
];

function board(over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'unit-test',
        seed: 'unit-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: PLAYERS,
        enemyParty: ENEMIES,
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [],
            hand: [
                { id: 'atk', dataId: ENEMY_ONLY_CARD, currentCost: 1, isPlayable: true },
                { id: 'self', dataId: SELF_ONLY_CARD, currentCost: 1, isPlayable: true },
            ],
            discard: [], exhaust: [],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...over,
    } as unknown as IBattleState;
}

function render(
    entity: IBattleEntity,
    isEnemy: boolean,
    opts: { card?: string | null; source?: string | null; state?: IBattleState } = {},
): string {
    return renderToStaticMarkup(
        <MingmingUnit
            entity={entity}
            isEnemy={isEnemy}
            isSelected={false}
            isTargeted={false}
            battleState={opts.state ?? board()}
            selectedCardId={opts.card ?? null}
            selectedSourceId={opts.source === undefined ? 'p1' : opts.source}
            onClick={() => undefined}
        />,
    );
}

// Anchored on the `<span`, because `hud-energy-pips` (the container) is a prefix of
// `hud-energy-pip` and a looser match counts it as a seventh pip.
const pipCount = (markup: string): number => (markup.match(/<span class="hud-energy-pip[" ]/g) ?? []).length;
const filledPips = (markup: string): number =>
    (markup.match(/<span class="hud-energy-pip"/g) ?? []).length;

describe('energy is legible at six entities', () => {
    it('renders an energy readout for every one of the six, player and enemy alike', () => {
        // The regression this guards is a layout fix that quietly drops the row on one side: the
        // enemy card is mirrored (`flex-direction: row-reverse`) and is the half that gets forgotten.
        for (const p of PLAYERS) {
            const markup = render(p, false);
            expect(markup, `${p.id} lost its energy row`).toContain(`data-testid="energy-pips-${p.id}"`);
            expect(markup).toContain(`${p.currentEnergy}`);
            expect(markup).toContain('EP');
        }
        for (const e of ENEMIES) {
            const markup = render(e, true);
            expect(markup, `${e.id} lost its energy row`).toContain(`data-testid="energy-pips-${e.id}"`);
            expect(markup).toContain('EP');
        }
    });

    it('draws one pip per point of MAX energy, filled to the CURRENT', () => {
        // A countable readout is the whole reason for the change: "2 of 3" has to be answerable
        // without reading the digits, because at six entities nobody reads six pairs of digits.
        const markup = render(unit('x', { maxEnergy: 3, currentEnergy: 2 }), false);
        expect(pipCount(markup)).toBe(3);
        expect(filledPips(markup)).toBe(2);
    });

    it('draws an empty track rather than nothing when a unit is spent out', () => {
        const markup = render(unit('x', { maxEnergy: 4, currentEnergy: 0 }), false);
        expect(pipCount(markup)).toBe(4);
        expect(filledPips(markup)).toBe(0);
        expect(markup).toContain('hud-energy-pip empty');
    });

    it('shows Energized carryover as its own pip, not as a longer gold run', () => {
        // 4/3 is the state a bar cannot express at all: it clamps and reads as full. The overflow
        // pip is the one Energy a player can LOSE by ending the turn, so it is worth its own colour.
        const markup = render(unit('x', { maxEnergy: 3, currentEnergy: 4 }), false);
        expect(pipCount(markup)).toBe(4);
        expect(markup).toContain('hud-energy-pip overflow');
    });

    it('falls back to the compact bar past the pip budget, keeping the card one line tall', () => {
        /*
         * The budget exists because the vertical arithmetic is the tighter constraint: a party column
         * spends 100 + 3×115 + 2×30 = 505px of the 535px a 1280×800 frame leaves beneath the 265px
         * console. Wrapping the energy row costs ~10px per card and three of them would spend all
         * 30px of slack, so past the budget the row compacts instead. This asserts the switch
         * happens rather than the row silently overflowing its 126px of track.
         */
        const over = render(unit('x', { maxEnergy: ENERGY_PIP_BUDGET + 1, currentEnergy: 2 }), false);
        expect(over).toContain('data-testid="energy-bar-x"');
        expect(over).not.toContain('data-testid="energy-pips-x"');
        // The number never goes away, whichever form the track takes — it is the un-hidden number.
        expect(over).toContain('EP');

        const atBudget = render(unit('y', { maxEnergy: ENERGY_PIP_BUDGET, currentEnergy: 2 }), false);
        expect(atBudget).toContain('data-testid="energy-pips-y"');
        expect(pipCount(atBudget)).toBe(ENERGY_PIP_BUDGET);
    });
});

describe('target validity is obvious, and the invalid case says why', () => {
    it('marks a legal target', () => {
        expect(render(ENEMIES[0], true, { card: 'atk' })).toContain('✓ TARGET');
        expect(render(ENEMIES[0], true, { card: 'atk' })).toContain('hud-target-legal');
    });

    it('refuses an enemy-only card on an ally IN WORDS, not by going inert', () => {
        const markup = render(PLAYERS[1], false, { card: 'atk' });
        expect(markup).toContain('hud-target-illegal');
        expect(markup).toContain('only hits enemies');
        expect(markup).not.toContain('✓ TARGET');
    });

    it('refuses a self-only card on an enemy IN WORDS', () => {
        const markup = render(ENEMIES[0], true, { card: 'self' });
        expect(markup).toContain('only lands on its caster');
    });

    it('excludes dead targets and says that is why', () => {
        const dead = unit('e_dead', { currentHp: 0 });
        const state = board({ enemyParty: [dead, ENEMIES[1], ENEMIES[2]] });
        const markup = render(dead, true, { card: 'atk', state });
        expect(markup).toContain('terminated');
        expect(markup).toContain('cannot be targeted');
    });

    it('says a caster is missing rather than blaming the target for it', () => {
        // Every card is illegal with nobody selected, so "this card cannot go here" would be both
        // true and useless. The refusal names the thing the player can actually fix.
        const markup = render(ENEMIES[0], true, { card: 'atk', source: null });
        expect(markup).toContain('Pick a living caster first');
    });

    it('says nothing at all when no card is selected — six units of chrome is not an affordance', () => {
        const markup = render(ENEMIES[0], true, { card: null });
        expect(markup).not.toContain('hud-target-flag');
        expect(markup).not.toContain('hud-target-legal');
        expect(markup).not.toContain('hud-target-illegal');
    });
});
