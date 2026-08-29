/**
 * THE MACRO RACK, RENDERED — ticket 15.
 *
 * `engine/macros.test.ts` proves what a macro does. What is left, and is a different failure, is
 * whether the rack **says** it — and one clause of that is formal law rather than polish:
 *
 * > **`power` NEVER.** Standing law (map § Notes): power dies at the surface, and
 * > `macros-and-drivers.md` adds *"previews show true damage everywhere, power remains the pricing
 * > currency."* Ticket 13 established the test shape for it on `MarketplaceNode`, and the cheapest
 * > way to break it here would be a well-meant reuse of `CardHand.formatAction`, which prints
 * > `action.power` straight out of the data.
 *
 * So this asserts both halves: the rendered markup contains no "power" at all, **and** the number a
 * Surge slot prints is the HP the target will actually lose rather than the figure on the tin.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import MacroRack from './MacroRack';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { MacroSlots } from '../../engine/runTypes';

// The same board `engine/macros.test.ts` uses: attack 45 into defense 30 makes Surge land on a whole
// 8, so the assertion below can be an exact number rather than a range.
const ATTACK = 45;
const DEFENSE = 30;
const MAX_HP = 100;

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name: id.toUpperCase(),
        definitionId: 'test_def',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: MAX_HP, currentHp: MAX_HP,
        cardDraw: 1, maxEnergy: 3, currentEnergy: 3,
        attack: ATTACK, defense: DEFENSE, speed: 10,
        primaryElement: 'Fire',
        tempHp: 0, statusEffects: [], daemons: [],
        ...over,
    } as IBattleEntity;
}

function board(over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'rack-test',
        seed: 'rack-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [unit('p1'), unit('p2', { currentHp: 40 })],
        enemyParty: [unit('e1', { primaryElement: 'Water' })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...over,
    } as IBattleState;
}

function render(
    macros: MacroSlots,
    over: Partial<IBattleState> = {},
    selected: { source?: string | null; target?: string | null } = {},
): string {
    return renderToStaticMarkup(
        <MacroRack
            macros={macros}
            battleState={board(over)}
            selectedSourceId={selected.source === undefined ? 'p1' : selected.source}
            selectedTargetId={selected.target === undefined ? 'e1' : selected.target}
            onFire={() => undefined}
        />,
    );
}

describe('MacroRack', () => {
    it('never prints the word “power”, anywhere, for any macro', () => {
        // Every macro in one rack is impossible (three slots), so the law is checked a rack at a
        // time across the whole registry — including the tooltips, which live in `title` attributes
        // and therefore ARE in the markup.
        const racks: MacroSlots[] = [
            ['surge', 'mend', 'venom_shot'],
            ['kindle', 'rally', 'cripple'],
            ['salve', 'free_exec', 'echo'],
            ['cache_pull', 'recharge', 'revive'],
            ['ping_sweep', null, null],
        ];
        for (const rack of racks) {
            expect(render(rack)).not.toMatch(/power/i);
        }
    });

    it('shows the TRUE damage a Surge will do, not the figure it is priced at', () => {
        const markup = render(['surge', null, null]);
        expect(markup).toContain('8 damage');
        // The printed figure is 30 and it must not surface. Word-bounded so an unrelated "130"
        // could never make this pass or fail by accident.
        expect(markup).not.toMatch(/\b30\b/);
    });

    it('shows the TRUE HP a Mend will restore', () => {
        // 7.5% of the RECEIVER's 100 max HP, floored — and the receiver is the picked ally.
        expect(render(['mend', null, null], {}, { target: 'p2' })).toContain('7 HP restored');
    });

    it('says “0 HP restored” rather than endorsing a wasted Mend', () => {
        // p1 is at full health. A single-use consumable's preview must never read as an
        // encouragement to spend it for nothing.
        expect(render(['mend', null, null], {}, { target: 'p1' })).toContain('0 HP restored');
    });

    it('prints a fixed-count macro`s own words, because that count IS the true number', () => {
        expect(render(['venom_shot', null, null])).toContain('3 Poison');
        expect(render(['cache_pull', null, null])).toContain('Draw 2 cards');
        expect(render(['recharge', null, null])).toContain('+1 Energy');
    });

    it('draws all three slots, empties included, so the rack size is visible', () => {
        const markup = render(['surge', null, null]);
        expect(markup.match(/macro-slot/g)?.length).toBeGreaterThanOrEqual(3);
        expect(markup.match(/empty<\/span>/g)?.length).toBe(2);
    });

    it('disables a slot that cannot fire AND says why', () => {
        // Ticket 20's precedent: a silently inert control is indistinguishable from a bug. Here it
        // is worse than usual — the player is deciding whether to spend a consumable.
        const noTarget = render(['surge', null, null], {}, { target: null });
        expect(noTarget).toContain('disabled');
        expect(noTarget).toContain('Pick a valid target first');

        const echoWithNothing = render(['echo', null, null]);
        expect(echoWithNothing).toContain('You have not played a card yet');

        const onTheMap = render(['ping_sweep', null, null]);
        expect(onTheMap).toContain('Fires from the map');
    });

    it('is dead on the enemy`s turn — “fired free on YOUR turn”', () => {
        const markup = render(['surge', null, null], { activeSide: 'ENEMY' });
        expect(markup).toContain('Only on your turn');
        expect(markup).toContain('disabled');
    });

    it('says what a macro is: free and single use', () => {
        expect(render([null, null, null])).toContain('free · single use');
    });
});
