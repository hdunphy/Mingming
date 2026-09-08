/**
 * TICKET 145a — THE STAGGER STAGE, AS RENDERED.
 *
 * `stageGeometry.test.ts` holds the ARITHMETIC to the mock. This holds the COMPONENT to the
 * arithmetic: that every unit is on the board (the whole point of replacing the two spotlights),
 * that the plaques land outside their columns, that the active ally is the only thing that moves,
 * and that a dead unit keeps its slot.
 *
 * Rendered to static markup — the convention `MingmingUnit.test` established, and for its reason:
 * there is no `@testing-library/react` in this repo and a lockfile change is forbidden. Server
 * rendering also means `useStageAnchors` takes its viewport from `setServerViewport`, which is why
 * that export exists and why a size can be asserted at all.
 */
import type React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import BattleStage from './BattleStage';
import { setServerViewport } from '../hooks/useStageAnchors';
import { ACTIVE_STEP, REF_HEIGHT, REF_WIDTH, REVEAL_RECT, plaqueRect, spriteRect } from './stageGeometry';
import type { Element, IBattleEntity, IBattleState } from '../../engine/types';

function unit(id: string, name: string, element: string, hp = 100): IBattleEntity {
    return {
        id, name, definitionId: name.toLowerCase(), blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 100, currentHp: hp,
        cardDraw: 3, maxEnergy: 2, currentEnergy: 2, attack: 45, defense: 30, speed: 10,
        primaryElement: element as Element, secondaryElement: 'None' as Element,
        speciesId: name.toLowerCase(), level: 15, activeOS: `${name.toLowerCase()}_v1`,
        daemons: [], statusEffects: [],
    } as unknown as IBattleEntity;
}

const ALLIES = [unit('p1', 'FENRIR', 'Fire'), unit('p2', 'SKOLL', 'Fire'), unit('p3', 'RATATOSKR', 'Nature')];
const ENEMIES = [unit('e1', 'KRAKEN', 'Water'), unit('e2', 'HULDRA', 'Nature'), unit('e3', 'NIDHOGGR', 'Dark')];

function state(allies = ALLIES, enemies = ENEMIES): IBattleState {
    return {
        playerParty: allies, enemyParty: enemies,
        activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
        playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 0,
    } as unknown as IBattleState;
}

type Over = Partial<React.ComponentProps<typeof BattleStage>>;

function render(over: Over = {}, s: IBattleState = state()): string {
    return renderToStaticMarkup(
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
            {...over}
        />,
    );
}

/** The inline `left:` of one slot or plaque, as rendered. */
function leftOf(markup: string, testId: string): number {
    const at = markup.indexOf(`data-testid="${testId}"`);
    expect(at, `${testId} is not on the stage`).toBeGreaterThan(-1);
    // The style attribute sits after the testid on these elements.
    const style = markup.slice(at, at + 400);
    const m = style.match(/left:([0-9.]+)px/);
    expect(m, `${testId} has no left`).not.toBeNull();
    return Number(m![1]);
}

beforeEach(() => setServerViewport(REF_WIDTH, REF_HEIGHT));

describe('145a — every unit is on the board', () => {
    it('draws a slot and a plaque for all six, not two spotlights', () => {
        // The regression this guards is the whole ticket. The old stage promoted one ally and one
        // enemy and left the other four to sidebar HUD cards; Henry: "the active Mingming is really
        // awkward".
        const markup = render();
        for (const e of [...ALLIES, ...ENEMIES]) {
            expect(markup).toContain(`data-testid="stage-slot-${e.id}"`);
            expect(markup).toContain(`data-testid="stage-plaque-${e.id}"`);
        }
    });

    it('keeps a dead unit in its slot rather than removing it', () => {
        // §2b draws it as a silhouette (145b), and §3 needs the anchor to survive the death because
        // 146 plays the death FX AT the slot.
        const dead = [ENEMIES[0], unit('e2', 'HULDRA', 'Nature', 0), ENEMIES[2]];
        const markup = render({}, state(ALLIES, dead));
        expect(markup).toContain('data-testid="stage-slot-e2"');
        expect(leftOf(markup, 'stage-slot-e2')).toBe(spriteRect('enemy', 1).x);
    });
});

describe('145a — the stagger', () => {
    it('puts every plaque outside its column, clear of the reveal lane', () => {
        const markup = render();
        for (const e of ALLIES) {
            expect(leftOf(markup, `stage-plaque-${e.id}`)).toBeLessThan(REVEAL_RECT.x);
        }
        for (const e of ENEMIES) {
            expect(leftOf(markup, `stage-plaque-${e.id}`)).toBeGreaterThan(REVEAL_RECT.x + REVEAL_RECT.w);
        }
    });

    it('steps the SELECTED ally toward the centre, and nothing else', () => {
        const first = render({ selectedSourceId: 'p1' });
        const second = render({ selectedSourceId: 'p2' });
        expect(leftOf(first, 'stage-slot-p1') - leftOf(second, 'stage-slot-p1')).toBe(ACTIVE_STEP);
        expect(leftOf(second, 'stage-slot-p2') - leftOf(first, 'stage-slot-p2')).toBe(ACTIVE_STEP);
        // The enemies do not care whose turn it is.
        for (const e of ENEMIES) {
            expect(leftOf(first, `stage-slot-${e.id}`)).toBe(leftOf(second, `stage-slot-${e.id}`));
        }
    });

    it('does not move a slot when a card is picked up or a target is chosen', () => {
        // §3's guarantee, stated as the thing 146 depends on: selection must not move geometry.
        const idle = render();
        const targeting = render({ selectedTargetId: 'e1', isTargeting: true, hoveredEntityId: 'e2' });
        for (const e of [...ALLIES, ...ENEMIES]) {
            expect(leftOf(targeting, `stage-slot-${e.id}`)).toBe(leftOf(idle, `stage-slot-${e.id}`));
        }
    });

    it('falls back to the first LIVING ally when nothing is selected', () => {
        const allies = [unit('p1', 'FENRIR', 'Fire', 0), ALLIES[1], ALLIES[2]];
        const markup = render({ selectedSourceId: null }, state(allies, ENEMIES));
        expect(leftOf(markup, 'stage-slot-p2')).toBe(spriteRect('ally', 1, 1).x);
        expect(leftOf(markup, 'stage-slot-p1')).toBe(spriteRect('ally', 0, 1).x);
    });
});

describe('145a — the composition on a real viewport', () => {
    it('is the mock at 1280x800', () => {
        const markup = render();
        expect(leftOf(markup, 'stage-slot-p1')).toBe(spriteRect('ally', 0, 0).x);
        expect(leftOf(markup, 'stage-plaque-e1')).toBe(plaqueRect('enemy', 0).x);
    });

    it('spreads the columns at 1920x1080 rather than sitting in the corner', () => {
        // The first version of the screenshot harness imported the anchors through a second module
        // instance, so `setServerViewport` wrote to a copy nothing read and BOTH renders came out at
        // 1280 — a scaling bug that was not in the geometry. This is the assertion that would have
        // caught it.
        setServerViewport(1920, 1080);
        const wide = render();
        setServerViewport(REF_WIDTH, REF_HEIGHT);
        const ref = render();
        expect(leftOf(wide, 'stage-slot-p1')).toBeGreaterThan(leftOf(ref, 'stage-slot-p1'));
        expect(leftOf(wide, 'stage-slot-e1')).toBeGreaterThan(leftOf(ref, 'stage-slot-e1'));
    });
});
