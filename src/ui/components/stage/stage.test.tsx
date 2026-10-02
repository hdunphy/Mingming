/**
 * TICKET 183b — THE BATTLE STAGE IN THE SLANT KIT, AS RENDERED.
 *
 * `BattleStage.test.tsx` holds the stage to the geometry (every unit on the board, plaques outside
 * their columns, nothing moves on selection). This holds the new look to the ticket's rows: the
 * biome picks its band set, the platform and cursor say who is acting, the plaque carries every
 * field with Bark Shield on the bar rather than in the status row, and the target feedback says its
 * words. Rendered to static markup, the convention that file set.
 */
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Element, IBattleEntity, IBattleState } from '../../../engine/types';
import { setServerViewport } from '../../hooks/useStageAnchors';
import BattleStage from '../BattleStage';
import { REF_HEIGHT, REF_WIDTH } from '../stageGeometry';
import { barkShieldPoints } from './barkShield';
import { BACKDROP_H, BACKDROP_W, FAR_HILLS, hillPoints } from './biomeShapes';
import { BiomeBackdrop } from './BiomeBackdrop';
import { TargetFlag } from './TargetFlag';

function unit(id: string, name: string, element: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name, definitionId: name.toLowerCase(), blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 1000, currentHp: 900,
        cardDraw: 3, maxEnergy: 2, currentEnergy: 2, attack: 45, defense: 30, speed: 10,
        primaryElement: element as Element, secondaryElement: 'None' as Element,
        speciesId: name.toLowerCase(), level: 15, activeOS: `${name.toLowerCase()}_v1`,
        daemons: [], statusEffects: [], ...over,
    } as unknown as IBattleEntity;
}

const ALLIES = [unit('p1', 'FENRIR', 'Fire'), unit('p2', 'SKOLL', 'Fire'), unit('p3', 'RATATOSKR', 'Nature')];
const ENEMIES = [unit('e1', 'KRAKEN', 'Water'), unit('e2', 'HULDRA', 'Nature'), unit('e3', 'NIDHOGGR', 'Dark')];

function state(over: Partial<IBattleState> = {}, allies = ALLIES, enemies = ENEMIES): IBattleState {
    return {
        playerParty: allies, enemyParty: enemies,
        activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
        playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 0, ...over,
    } as unknown as IBattleState;
}

function render(s: IBattleState = state()): string {
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
        />,
    );
}

const plaqueOf = (markup: string, id: string): string => {
    const at = markup.indexOf(`data-testid="stage-plaque-${id}"`);
    const rest = markup.slice(at);
    // To the next plaque or the end of the stage's bodies.
    const next = rest.slice(10).search(/data-testid="stage-(slot|plaque)-/);
    return next === -1 ? rest : rest.slice(0, next + 10);
};

beforeEach(() => setServerViewport(REF_WIDTH, REF_HEIGHT));

describe('183b — the biome backdrop', () => {
    it('draws five flat bands and the horizon, with no gradient', () => {
        const html = renderToStaticMarkup(<BiomeBackdrop />);
        for (const band of ['bd-sky', 'bd-far', 'bd-near', 'bd-ground', 'bd-horizon', 'bd-strip']) {
            expect(html, band).toContain(band);
        }
        expect(html).not.toMatch(/gradient|filter|blur/i);
    });

    it("picks the biome's band set off the biome's element", () => {
        expect(render(state({ biomeElement: 'Fire' } as never))).toContain('data-biome="fire"');
        expect(render(state({ biomeElement: 'Water' } as never))).toContain('data-biome="water"');
        expect(render(state({ biomeElement: 'Nature' } as never))).toContain('data-biome="nature"');
    });

    it('falls back to the Neutral set for no biome, and for an element with no set of its own', () => {
        expect(render(state())).toContain('data-biome="none"');
        expect(render(state({ biomeElement: 'Dark' } as never))).toContain('data-biome="none"');
    });

    it('has the five tokens for every set in tokens.css', () => {
        const css = readFileSync(new URL('../../theme/tokens.css', import.meta.url), 'utf8');
        for (const biome of ['none', 'nature', 'water', 'fire']) {
            const block = css.match(new RegExp(`\\[data-biome='${biome}'\\][^{]*\\{([^}]*)\\}`));
            expect(block, biome).not.toBeNull();
            for (const token of ['--sky', '--far', '--near', '--ground', '--ground-2']) {
                expect(block![1], `${biome} ${token}`).toContain(`${token}:`);
            }
        }
    });

    it('draws the hills inside the backdrop box', () => {
        const points = hillPoints(FAR_HILLS).split(' ').map((p) => p.split(',').map(Number));
        for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(BACKDROP_W);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(BACKDROP_H);
        }
    });
});

describe('183b — the plaque', () => {
    it('carries every field for a 3v3 body: name, element, HP, energy, firmware, statuses', () => {
        const fenrir = unit('p1', 'FENRIR', 'Fire', {
            statusEffects: [{ id: 's1', type: 'Strengthened', stacks: 19, duration: 3, sourceId: 'x' }] as never,
        });
        const html = plaqueOf(render(state({}, [fenrir, ALLIES[1], ALLIES[2]])), 'p1');
        expect(html).toContain('FENRIR');
        expect(html).toContain('aria-label="Fire"');            // the element badge
        expect(html).toContain('role="progressbar"');           // the HP bar
        expect(html).toContain('900');
        expect(html).toContain('/1000');
        expect(html).toContain('aria-label="Energy 2/2"');      // the hexagon
        expect(html).toContain('hud-os-icon-container');        // the firmware chip
        expect(html).toContain('data-status="Strengthened"');   // the chip
    });

    it('puts the element slash on the face that looks at the monster', () => {
        const markup = render();
        expect(plaqueOf(markup, 'p1')).toContain('k-slash-right');
        expect(plaqueOf(markup, 'e1')).toContain('k-slash-left');
    });

    it('keeps the ruled 168px width and scales as one piece', () => {
        const html = plaqueOf(render(), 'p1');
        expect(html).toMatch(/width:168px/);
        expect(html).toMatch(/transform:scale\(1\)/);
    });

    it('draws Bark Shield as a band on the HP bar with its HP, and not as a status chip', () => {
        const shielded = unit('p1', 'FENRIR', 'Fire', {
            statusEffects: [
                { id: 'b', type: 'BarkShield', stacks: 25, duration: 3, sourceId: 'x' },
                { id: 'w', type: 'Weakened', stacks: 2, duration: 3, sourceId: 'x' },
            ] as never,
        });
        const html = plaqueOf(render(state({}, [shielded, ALLIES[1], ALLIES[2]])), 'p1');
        // 25% of 1000 max HP.
        expect(html).toMatch(/data-testid="hp-shield"[^>]*>250</);
        expect(html).not.toContain('data-status="BarkShield"');
        expect(html).toContain('data-status="Weakened"');
    });

    it('draws no band, and no empty status row, on a clean body', () => {
        const html = plaqueOf(render(), 'p1');
        expect(html).not.toContain('hp-shield');
        expect(html).not.toContain('plaque-statuses');
    });

    it('reads the shield in HP points off the stacks, which are a percent of max HP', () => {
        expect(barkShieldPoints(unit('x', 'X', 'None', {
            maxHp: 800, statusEffects: [{ type: 'BarkShield', stacks: 12.5 }] as never,
        }))).toBe(100);
        expect(barkShieldPoints(unit('x', 'X', 'None'))).toBe(0);
    });
});

describe('183b — the target feedback', () => {
    it('says "Super effective" under a cursor for a super-effective hover', () => {
        const html = renderToStaticMarkup(<TargetFlag verdict={{ ok: true, reason: null }} effectiveness={1.5} />);
        expect(html).toContain('stage-target-cursor');
        expect(html).toContain('Super effective');
    });

    it('says "Not very effective" for a resisted one, and only the cursor for a neutral one', () => {
        expect(renderToStaticMarkup(<TargetFlag verdict={{ ok: true, reason: null }} effectiveness={0.5} />))
            .toContain('Not very effective');
        const neutral = renderToStaticMarkup(<TargetFlag verdict={{ ok: true, reason: null }} effectiveness={1} />);
        expect(neutral).toContain('stage-target-cursor');
        expect(neutral).not.toContain('effective');
    });

    it('says nothing for a legal target the pointer is not on', () => {
        expect(renderToStaticMarkup(<TargetFlag verdict={{ ok: true, reason: null }} effectiveness={null} />)).toBe('');
    });

    it('says "Can\'t target" for an illegal one, with the reason on hover', () => {
        const html = renderToStaticMarkup(
            <TargetFlag verdict={{ ok: false, reason: 'Bite only hits enemies.' }} effectiveness={null} />,
        );
        expect(html).toContain('Can&#x27;t target');
        expect(html).toContain('title="Bite only hits enemies."');
        expect(html).not.toContain('stage-target-cursor');
    });

    it('draws the yellow cursor and the words in the selection colour only', () => {
        const css = readFileSync(new URL('./stage.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.stage-target-cursor\s*\{[^}]*var\(--select\)/);
        expect(css).toMatch(/\.stage-target-words\.is-super\s*\{[^}]*var\(--select\)/);
    });
});

describe('183b — no glow, no blur, no gradient in the stage', () => {
    it('keeps the stage and top bar stylesheets flat', () => {
        for (const file of ['./stage.css', '../topbar/topbar.css']) {
            const css = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
            expect(css, file).not.toMatch(/gradient\(|backdrop-filter|filter:\s*blur|box-shadow:\s*0 0|text-shadow:\s*0 0/);
        }
    });
});
