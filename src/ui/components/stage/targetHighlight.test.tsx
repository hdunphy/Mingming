// @vitest-environment jsdom
/**
 * TICKET 194h — the enemy your card's preview is for is unmistakable.
 *
 * Henry, 2026-10-04: "I can't tell which enemy is being targeted for the preview of my card."
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GetProgramData } from '../../../engine/data/programRegistry';
import type { Element, IBattleEntity, IBattleState, ProgramEntity } from '../../../engine/types';
import { setServerViewport } from '../../hooks/useStageAnchors';
import BattleStage from '../BattleStage';
import { REF_HEIGHT, REF_WIDTH } from '../stageGeometry';
import { targetHighlight } from './targetHighlight';

const units = [
    { id: 'p1', legal: false, isEnemy: false }, { id: 'p2', legal: false, isEnemy: false },
    { id: 'e1', legal: true, isEnemy: true }, { id: 'e2', legal: true, isEnemy: true }, { id: 'e3', legal: true, isEnemy: true },
];
const fireball = GetProgramData('ember_jab');

describe('194h — targetHighlight', () => {
    it('with no card held, nothing is marked', () => {
        const h = targetHighlight({ card: null, units, casterId: 'p1', hoveredId: 'e1' });
        expect([...h.strong, ...h.soft]).toEqual([]);
    });

    it('with a card held and no hover, every legal enemy is soft', () => {
        const h = targetHighlight({ card: fireball, units, casterId: 'p1', hoveredId: null });
        expect([...h.strong]).toEqual([]);
        expect([...h.soft].sort()).toEqual(['e1', 'e2', 'e3']);
    });

    it('hovering one makes it strong and the others soft', () => {
        const h = targetHighlight({ card: fireball, units, casterId: 'p1', hoveredId: 'e2' });
        expect([...h.strong]).toEqual(['e2']);
        expect([...h.soft].sort()).toEqual(['e1', 'e3']);
    });

    it('hovering a unit the card cannot land on marks nobody extra', () => {
        const h = targetHighlight({ card: fireball, units, casterId: 'p1', hoveredId: 'p2' });
        expect([...h.strong]).toEqual([]);
        expect([...h.soft].sort()).toEqual(['e1', 'e2', 'e3']);
    });

    it('an attack outlines only enemies softly, even though an ally is a legal target; hovering the ally marks it strong', () => {
        const withAllies = units.map((u) => ({ ...u, legal: true }));
        const idle = targetHighlight({ card: fireball, units: withAllies, casterId: 'p1', hoveredId: null });
        expect([...idle.soft].sort()).toEqual(['e1', 'e2', 'e3']);
        const onAlly = targetHighlight({ card: fireball, units: withAllies, casterId: 'p1', hoveredId: 'p2' });
        expect([...onAlly.strong]).toEqual(['p2']);
    });

    it('a card that picks for you strongly marks the unit it hits', () => {
        const self = { ...fireball, target: 'Self' as const };
        const h = targetHighlight({ card: self, units: [{ id: 'p1', legal: true, isEnemy: false }, ...units.slice(1)], casterId: 'p1', hoveredId: null });
        expect([...h.strong]).toEqual(['p1']);
    });

    it('a random-enemy card outlines every candidate softly and none strongly', () => {
        const random = { ...fireball, actions: [{ type: 'ATTACK', power: 5, target: 'RANDOM_ENEMY' }] } as never;
        const h = targetHighlight({ card: random, units, casterId: 'p1', hoveredId: 'e1' });
        expect([...h.strong]).toEqual([]);
        expect([...h.soft].sort()).toEqual(['e1', 'e2', 'e3']);
    });
});

// ---- the stage: the strong mark and the preview point at the same unit -----------------------

function unit(id: string, name: string, element: string): IBattleEntity {
    return {
        id, name, definitionId: name.toLowerCase(), blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 1000, currentHp: 900,
        cardDraw: 3, maxEnergy: 2, currentEnergy: 2, attack: 45, defense: 30, speed: 10,
        primaryElement: element as Element, secondaryElement: 'None' as Element,
        speciesId: name.toLowerCase(), level: 15, activeOS: `${name.toLowerCase()}_v1`,
        daemons: [], statusEffects: [],
    } as unknown as IBattleEntity;
}
const card: ProgramEntity = { id: 'c1', dataId: 'ember_jab', currentCost: 1, isPlayable: true } as ProgramEntity;
const battle = {
    playerParty: [unit('p1', 'FENRIR', 'Fire'), unit('p2', 'SKOLL', 'Fire')],
    enemyParty: [unit('e1', 'KRAKEN', 'Water'), unit('e2', 'HULDRA', 'Nature'), unit('e3', 'NIDHOGGR', 'Dark')],
    activeSide: 'PLAYER', turn: 1, phase: 'PLAYER_TURN',
    playerDeck: { hand: [card], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 0,
} as unknown as IBattleState;

const render = (hovered: string | null, held: boolean): string => renderToStaticMarkup(
    <BattleStage
        battleState={battle} selectedSourceId="p1" selectedTargetId={null}
        selectedCardId={held ? 'c1' : null} hoveredEntityId={hovered} isTargeting={held}
        unitFx={{}} onEntityClick={() => {}} onEntityPointerUp={() => {}} onEnemyHoverChange={() => {}}
    />,
);
const marks = (html: string, kind: string, scope: 'slot' | 'plaque'): string[] =>
    [...html.matchAll(new RegExp(`class="[^"]*stage-${scope}-mark-${kind}[^"]*"[^>]*data-testid="stage-${scope}-([a-z0-9]+)"`, 'g'))].map((m) => m[1]);

beforeEach(() => setServerViewport(REF_WIDTH, REF_HEIGHT));

describe('194h — on the stage', () => {
    it('with no card held, nothing is outlined', () => {
        const html = render(null, false);
        expect(html).not.toContain('stage-slot-mark-');
        expect(html).not.toContain('stage-plaque-mark-');
    });

    it('with a card held, every legal enemy body and plaque is soft', () => {
        const html = render(null, true);
        expect(marks(html, 'soft', 'slot').sort()).toEqual(['e1', 'e2', 'e3']);
        expect(marks(html, 'soft', 'plaque').sort()).toEqual(['e1', 'e2', 'e3']);
    });

    it('hovering e2: e2 is strong on body and plaque, carries the preview, the others stay soft', () => {
        const html = render('e2', true);
        expect(marks(html, 'strong', 'slot')).toEqual(['e2']);
        expect(marks(html, 'strong', 'plaque')).toEqual(['e2']);
        expect(marks(html, 'soft', 'slot').sort()).toEqual(['e1', 'e3']);
        // The preview block is inside the strong plaque and nowhere else.
        const previews = [...html.matchAll(/data-testid="stage-plaque-([a-z0-9]+)"[\s\S]*?(?=data-testid="stage-(?:slot|plaque)-|$)/g)]
            .filter((m) => m[0].includes('stage-plaque-preview')).map((m) => m[1]);
        expect(previews).toEqual(['e2']);
    });
});
