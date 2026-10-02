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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import BattleStage from './BattleStage';
import { setServerViewport } from '../hooks/useStageAnchors';
import { ACTIVE_STEP, REF_HEIGHT, REF_WIDTH, REVEAL_RECT, enemyShiftFor, plaqueRect, spriteRect } from './stageGeometry';
import { PLAQUE_CHIP_BUDGET } from './stage/StatusChipRow';
import type { Element, IBattleEntity, IBattleState } from '../../engine/types';

// The art policy is a build-time constant; this lets one file exercise both sides of it.
const artPolicy = vi.hoisted(() => ({ enabled: false }));
vi.mock('./monsterArtPolicy', () => ({
    get MONSTER_ART_ENABLED() { return artPolicy.enabled; },
}));

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

const TYPES = ['Dazed', 'Sharp', 'Burn', 'Poison', 'Strengthened', 'Weakened', 'Regen', 'Asleep'] as const;
/** n statuses with ascending stacks, so "which ones survive the budget" is decidable. */
const statuses = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, type: TYPES[i], stacks: i + 2, duration: 3, sourceId: 'x',
}));
const withStatuses = (e: IBattleEntity, n: number): IBattleEntity =>
    ({ ...e, statusEffects: statuses(n) } as unknown as IBattleEntity);

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
function topOf(markup: string, testId: string): number {
    const at = markup.indexOf(`data-testid="${testId}"`);
    expect(at, `${testId} is not on the stage`).toBeGreaterThan(-1);
    const m = markup.slice(at, at + 400).match(/top:([0-9.]+)px/);
    expect(m, `${testId} has no top`).not.toBeNull();
    return Number(m![1]);
}

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

/**
 * TICKET 167g: the enemy column slides to the enemy hand panel's edge (`enemyShiftFor`), so an
 * enemy is no longer exactly on the mock's x. These states carry no `enemyMode`, i.e. a MOVES
 * fight, which takes the CLOSED value. Allies are untouched and still exactly the mock.
 */
const CLOSED_SHIFT = enemyShiftFor(REF_WIDTH, REF_HEIGHT, false);

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
        expect(leftOf(markup, 'stage-slot-e2')).toBe(spriteRect('enemy', 1, -1, CLOSED_SHIFT).x);
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

describe('145b — the plaque carries the statuses', () => {
    /*
     * The statuses lived on the sidebar HUD card, which the stagger stage replaces. Until they
     * moved, `SHOW_LEGACY_HUD_COLUMNS` could not be turned off without taking the only readable
     * copy of a Dazed count off the screen with it.
     */
    it('draws a chip per status, on the unit that has it', () => {
        const allies = [withStatuses(ALLIES[0], 3), ALLIES[1], ALLIES[2]];
        const markup = render({}, state(allies, ENEMIES));
        const plaque = markup.slice(markup.indexOf('data-testid="stage-plaque-p1"'));
        const chips = (plaque.slice(0, plaque.indexOf('stage-plaque-p2')).match(/data-status="/g) ?? []);
        expect(chips).toHaveLength(3);
    });

    it('stops at the plaque budget and names the rest in a chip', () => {
        // The plaque's status row spends PLAQUE_CHIP_BUDGET plates; the `+k` chip is one of them, so
        // eight statuses show five and fold three.
        const allies = [withStatuses(ALLIES[0], 8), ALLIES[1], ALLIES[2]];
        const markup = render({}, state(allies, ENEMIES));
        const plaque = markup.slice(
            markup.indexOf('data-testid="stage-plaque-p1"'),
            markup.indexOf('data-testid="stage-slot-p2"'),
        );
        expect(plaque.match(/data-status="/g) ?? []).toHaveLength(PLAQUE_CHIP_BUDGET - 1);
        expect(plaque).toContain('hud-status-stacks');
        expect(plaque).toContain(`+${8 - (PLAQUE_CHIP_BUDGET - 1)}`);
    });

    it('keeps the DEEPEST piles when it has to hide any', () => {
        // The number a payoff card is waiting on must not be the one that falls off the end.
        const allies = [withStatuses(ALLIES[0], 8), ALLIES[1], ALLIES[2]];
        const markup = render({}, state(allies, ENEMIES));
        const plaque = markup.slice(markup.indexOf('data-testid="stage-plaque-p1"'));
        const shown = plaque.slice(0, plaque.indexOf('hud-status-stacks'));
        expect(shown).toContain('\u00d79');   // stacks 9, the deepest
        expect(shown).not.toContain('\u00d72'); // stacks 2, the shallowest
    });

    it('says nothing at all when a unit is clean — no empty row', () => {
        const markup = render();
        expect(markup).not.toContain('data-status="');
        expect(markup).not.toContain('plaque-statuses');
    });
});

describe('145b — active and dead read at a glance', () => {
    /*
     * TICKET 183b: no rim light. The acting ally is said by its yellow platform and the caster
     * cursor, on the art path and on the placeholder alike, so a species whose sprite has not
     * landed yet is not the one unit on the board that never looks like it is acting.
     */
    const withArt = (es: IBattleEntity[]) =>
        es.map(e => ({ ...e, artReference: `${e.name.toLowerCase()}.png` } as unknown as IBattleEntity));

    const actingIs = (markup: string, id: 'p1' | 'p2' | 'p3'): void => {
        // A slot's platform and cursor are painted just before its slot, so they sit between the
        // previous plaque and this one's.
        const order = ['p1', 'p2', 'p3'];
        const from = id === 'p1' ? 0 : markup.indexOf(`stage-plaque-${order[order.indexOf(id) - 1]}`);
        const to = markup.indexOf(`stage-plaque-${id}`);
        const own = markup.slice(from, to);
        expect(own).toContain('stage-platform is-active');
        expect(own).toContain('data-testid="caster-cursor"');
        expect(markup.match(/stage-platform is-active/g)).toHaveLength(1);
        expect(markup.match(/data-testid="caster-cursor"/g)).toHaveLength(1);
    };

    it('marks the acting ally with the yellow platform and the cursor, and nobody else, on the ART path', () => {
        artPolicy.enabled = true;
        let markup: string;
        try { markup = render({ selectedSourceId: 'p2' }, state(withArt(ALLIES), ENEMIES)); } finally { artPolicy.enabled = false; }
        actingIs(markup, 'p2');
    });

    it('marks it the same way on the ART-LESS fallback', () => {
        actingIs(render({ selectedSourceId: 'p2' }), 'p2');
        actingIs(render({ selectedSourceId: 'p3' }), 'p3');
    });

    it('gives an enemy a plain platform and never a cursor', () => {
        const markup = render();
        expect(markup.match(/class="stage-platform stage-enemy-shift"/g)).toHaveLength(3);
    });

    it('draws a dead unit as a dimmed silhouette, not a hidden one', () => {
        // §2b: 40% brightness, still in its slot. A FILTER on the art rather than an opacity on the
        // frame, so the TERMINATED stamp keeps its colour (ticket 34): the stylesheet holds the
        // filter, the frame carries the class.
        const enemies = [unit('e1', 'KRAKEN', 'Water', 0), ENEMIES[1], ENEMIES[2]];
        const markup = render({}, state(ALLIES, enemies));
        const e1 = markup.slice(markup.indexOf('stage-slot-e1'), markup.indexOf('stage-plaque-e1'));
        expect(e1).toContain('stage-sprite-dead');
        expect(markup).toContain('data-testid="stage-slot-e1"');
        const css = readFileSync(new URL('./stage/stage.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.stage-sprite-dead \.stage-art[^{]*\{[^}]*brightness\(0\.4\)/);
    });

    it('dims the dead unit PLAQUE too, so the board reads at a glance', () => {
        const enemies = [unit('e1', 'KRAKEN', 'Water', 0), ENEMIES[1], ENEMIES[2]];
        const markup = render({}, state(ALLIES, enemies));
        expect(markup).toContain('stage-plaque-dead');
    });
});
describe('145b — the plaque carries what the HUD card carried', () => {
    /*
     * `SHOW_LEGACY_HUD_COLUMNS` is false now, so the plaque is the ONLY place these three appear.
     * Henry: *"We need to include those three things please: firmware chip, daemon tags and
     * damage/status preview."* Each of these is the assertion that the column can stay off.
     */
    it('names the firmware on the plaque', () => {
        const markup = render();
        // TICKET 182a: the chip is the firmware icon; the "V1" balance label is cut.
        const plaque = markup.slice(markup.indexOf('stage-plaque-p1'), markup.indexOf('stage-slot-p2'));
        expect(plaque).toContain('hud-os-icon-container');
        expect(plaque).not.toContain('V1');
    });

    it('lists the daemons on the plaque, by name', () => {
        const withDaemon = {
            ...ALLIES[0],
            daemons: [{ id: 'd1', dataId: 'fertile_ground_daemon' }],
        } as unknown as IBattleEntity;
        const markup = render({}, state([withDaemon, ALLIES[1], ALLIES[2]], ENEMIES));
        const plaque = markup.slice(markup.indexOf('stage-plaque-p1'), markup.indexOf('stage-slot-p2'));
        expect(plaque).toContain('hud-daemon-tag');
    });

    it('says nothing about daemons or firmware a unit does not have', () => {
        const bare = { ...ALLIES[0], activeOS: undefined, daemons: [] } as unknown as IBattleEntity;
        const markup = render({}, state([bare, ALLIES[1], ALLIES[2]], ENEMIES));
        const plaque = markup.slice(markup.indexOf('stage-plaque-p1'), markup.indexOf('stage-slot-p2'));
        expect(plaque).not.toContain('hud-os-icon-container');
        expect(plaque).not.toContain('hud-daemon-tag');
    });
});
describe('145a — the composition on a real viewport', () => {
    it('is the mock at 1280x800 for the allies, and the mock plus the closed-panel slide for the enemies', () => {
        const markup = render();
        expect(leftOf(markup, 'stage-slot-p1')).toBe(spriteRect('ally', 0, 0).x);
        // 167g: 50 reference px right of the mock at 1280x800, so the closed tab has no white space.
        expect(CLOSED_SHIFT).toBe(50);
        expect(leftOf(markup, 'stage-plaque-e1')).toBe(plaqueRect('enemy', 0, -1, CLOSED_SHIFT).x);
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

describe('monster art policy — no artwork while it is switched off', () => {
    const withArt = (es: IBattleEntity[]) =>
        es.map(e => ({ ...e, artReference: `${e.name.toLowerCase()}.png` } as unknown as IBattleEntity));

    it('draws a WIP block, and no <img>, for a unit that has an artReference', () => {
        const markup = render({}, state(withArt(ALLIES), withArt(ENEMIES)));
        expect(markup).not.toContain('<img');
        expect(markup).not.toContain('battleArt');
        expect(markup.match(/data-testid="monster-art-wip"/g)).toHaveLength(6);
    });

    it('still marks the acting unit on the placeholder', () => {
        const markup = render({ selectedSourceId: 'p2' }, state(withArt(ALLIES), ENEMIES));
        const p2 = markup.slice(markup.indexOf('stage-plaque-p1'), markup.indexOf('stage-plaque-p2'));
        expect(p2).toContain('stage-platform is-active');
        expect(p2).toContain('monster-art-wip');
    });
});

describe('183e — the rows are centred by party size', () => {
    it('a 3v3 stands where the mock puts it', () => {
        const markup = render();
        expect([ 'p1', 'p2', 'p3' ].map((id) => topOf(markup, `stage-slot-${id}`))).toEqual([62, 232, 402]);
        expect([ 'e1', 'e2', 'e3' ].map((id) => topOf(markup, `stage-slot-${id}`))).toEqual([62, 232, 402]);
    });

    it('a 1v1 stands on the middle row, both sides', () => {
        const markup = render({}, state([ALLIES[0]], [ENEMIES[0]]));
        expect(topOf(markup, 'stage-slot-p1')).toBe(232);
        expect(topOf(markup, 'stage-slot-e1')).toBe(232);
        expect(topOf(markup, 'stage-plaque-p1')).toBe(232 + 48);
    });

    it('a 2v2 stands on 147 and 317', () => {
        const markup = render({}, state(ALLIES.slice(0, 2), ENEMIES.slice(0, 2)));
        expect(topOf(markup, 'stage-slot-p1')).toBe(147);
        expect(topOf(markup, 'stage-slot-p2')).toBe(317);
        expect(topOf(markup, 'stage-slot-e1')).toBe(147);
    });

    it('a 3v1 keeps the three rows: the larger side sets the layout', () => {
        const markup = render({}, state(ALLIES, [ENEMIES[0]]));
        expect(topOf(markup, 'stage-slot-p1')).toBe(62);
        expect(topOf(markup, 'stage-slot-e1')).toBe(62);
    });

    it('a death moves no row', () => {
        const before = render({}, state(ALLIES, ENEMIES));
        const dead = ENEMIES.map((e, i) => (i === 1 ? ({ ...e, currentHp: 0 } as IBattleEntity) : e));
        const after = render({}, state(ALLIES, dead));
        for (const id of ['p1', 'p2', 'p3', 'e1', 'e2', 'e3']) {
            expect(topOf(after, `stage-slot-${id}`)).toBe(topOf(before, `stage-slot-${id}`));
        }
    });
});
