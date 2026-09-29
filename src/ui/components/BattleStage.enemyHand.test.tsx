// @vitest-environment jsdom
/**
 * TICKET 167g — THE ENEMIES MEET THE ENEMY HAND PANEL, AS PLAYED.
 *
 * `BattleStage.test.tsx` renders to static markup and cannot click. This is the interaction half:
 * the panel's open state lives in `BattleStage`, and the enemy column has to follow it. Henry,
 * 2026-09-28: *"If the panel is open then push them towards the middle. If it is closed make sure
 * there isn't a gap of 'white space' between them."*
 */
import { describe, expect, it } from 'vitest';

import BattleStage from './BattleStage';
import { enemyShiftFor, spriteRect, place } from './stageGeometry';
import { makeStore, mount, click, flush } from '../../testing/interaction';
import type { Element, IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

function unit(id: string, name: string, element: string): IBattleEntity {
    return {
        id, name, definitionId: name.toLowerCase(), blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 100, currentHp: 100,
        cardDraw: 3, maxEnergy: 2, currentEnergy: 2, attack: 45, defense: 30, speed: 10,
        primaryElement: element as Element, secondaryElement: 'None' as Element,
        speciesId: name.toLowerCase(), level: 15, activeOS: `${name.toLowerCase()}_v1`,
        daemons: [], statusEffects: [],
    } as unknown as IBattleEntity;
}

const hand: ProgramEntity[] = [{ id: 'c0', dataId: 'ignite', currentCost: 1, isPlayable: true } as ProgramEntity];

function state(enemyMode: 'CARDS' | 'MOVES'): IBattleState {
    return {
        playerParty: [unit('p1', 'FENRIR', 'Fire'), unit('p2', 'SKOLL', 'Fire'), unit('p3', 'RATATOSKR', 'Nature')],
        enemyParty: [unit('e1', 'KRAKEN', 'Water'), unit('e2', 'HULDRA', 'Nature'), unit('e3', 'NIDHOGGR', 'Dark')],
        enemyMode,
        activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
        playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand, discard: [], exhaust: [] },
        counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 0,
    } as unknown as IBattleState;
}

const mountStage = (s: IBattleState) => mount(
    makeStore(),
    <BattleStage
        battleState={s}
        selectedSourceId="p1"
        selectedTargetId={null}
        selectedCardId={null}
        hoveredEntityId={null}
        isTargeting={false}
        unitFx={{}}
        onEntityClick={() => {}}
        onEntityPointerUp={() => {}}
        onEnemyHoverChange={() => {}}
    />,
);

/** Where enemy 2's slot should be drawn in THIS window for a given panel state. */
const expectedLeft = (open: boolean): number =>
    place(spriteRect('enemy', 1, -1, enemyShiftFor(window.innerWidth, window.innerHeight, open)), window.innerWidth, window.innerHeight).x;

const slotLeft = (host: HTMLElement, id: string): number =>
    parseFloat((host.querySelector(`[data-testid="stage-slot-${id}"]`) as HTMLElement).style.left);

describe('167g — the stage slides the enemies to meet the hand panel', () => {
    it('draws them against the closed tab, slides them toward the middle on open, and back on close', async () => {
        const host = await mountStage(state('CARDS'));
        const closed = slotLeft(host, 'e2');
        expect(closed).toBeCloseTo(expectedLeft(false), 4);

        await click(host.querySelector('.ehp-tab')!);
        await flush();
        const open = slotLeft(host, 'e2');
        expect(open).toBeCloseTo(expectedLeft(true), 4);
        expect(open).toBeLessThan(closed);

        await click(host.querySelector('.ehp-tab')!);
        await flush();
        expect(slotLeft(host, 'e2')).toBeCloseTo(closed, 4);
    });

    it('moves the plaques and the floor with the bodies, and never an ally', async () => {
        const host = await mountStage(state('CARDS'));
        const allyBefore = slotLeft(host, 'p2');
        const plaque = () => parseFloat((host.querySelector('[data-testid="stage-plaque-e2"]') as HTMLElement).style.left);
        const before = plaque();

        await click(host.querySelector('.ehp-tab')!);
        await flush();

        expect(plaque()).toBeLessThan(before);
        expect(slotLeft(host, 'p2')).toBe(allyBefore);
    });

    it('a MOVES fight has no panel and keeps the enemies at the closed position', async () => {
        const host = await mountStage(state('MOVES'));
        expect(host.querySelector('.ehp-tab')).toBeNull();
        expect(slotLeft(host, 'e2')).toBeCloseTo(expectedLeft(false), 4);
    });
});
