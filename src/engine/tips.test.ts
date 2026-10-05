/**
 * Ticket 24. What the tips module promises, held down.
 *
 * The weight is on `nextBattleTip` / `nextMapTip` because **they are the only half of onboarding a
 * test in this repo can reach**. There is no `@testing-library/react` (a lockfile change is
 * forbidden) and `renderToStaticMarkup` runs no effects, so "click Got it and see the next tip
 * appear" is not a test anyone can write here. Splitting the moment out of the component is what
 * makes the sequence testable at all — so the sequence is tested exhaustively.
 */

import { describe, expect, it } from 'vitest';

import {
    ALL_TIP_IDS,
    RANCH_BLUEPRINT_TIP,
    TIP_REGISTRY,
    nextBattleTip,
    nextMapTip,
} from './tips';
import { createRun } from './run/createRun';
import { offerGyms } from './run/gyms';
import { GetMingmingData } from './data/mingmingRegistry';
import { initializeBattleEntity } from './types';
import type { IBattleEntity, IBattleState, IMingmingState, ProgramEntity } from './types';
import type { IRunState } from './runTypes';
import { isWorkshopNode } from './run/workshop';

// --- Fixtures -----------------------------------------------------------------------------------

function entity(definitionId: string, id: string): IBattleEntity {
    const state: IMingmingState = {
        id,
        definitionId,
        activeOS: GetMingmingData(definitionId).availableOS[0],
        blueprintsCollected: 0,
        hpIV: 20,
        attackIV: 20,
        defenseIV: 20,
    };
    return initializeBattleEntity(state, GetMingmingData(definitionId));
}

const card = (dataId: string): ProgramEntity => ({
    id: `card_${dataId}`,
    dataId,
    currentCost: 1,
    isPlayable: true,
});

interface StateOverrides {
    readonly player?: ReadonlyArray<IBattleEntity>;
    readonly enemy?: ReadonlyArray<IBattleEntity>;
    readonly hand?: ReadonlyArray<ProgramEntity>;
    readonly cardsPlayedThisTurn?: number;
    readonly activeSide?: 'PLAYER' | 'ENEMY';
}

/**
 * A battle state with only the fields the tip predicates read. Cast once, here, rather than
 * building a real `createBattleState` — the predicates are deliberately narrow and a fixture that
 * had to be a whole battle would hide which fields they actually touch.
 */
function battle(overrides: StateOverrides = {}): IBattleState {
    const player = overrides.player ?? [entity('kraken', 'p1')];
    const enemy = overrides.enemy ?? [entity('kraken', 'e1')];
    return {
        activeSide: overrides.activeSide ?? 'PLAYER',
        playerParty: player,
        enemyParty: enemy,
        cardsPlayedThisTurn: overrides.cardsPlayedThisTurn ?? 0,
        playerDeck: { ownerId: 'p1', deck: [], drawpile: [], hand: overrides.hand ?? [], discard: [], exhaust: [] },
    } as unknown as IBattleState;
}

function run(): IRunState {
    const offer = offerGyms('tips-test-seed')[0];
    const party: IMingmingState[] = [
        {
            id: 'm1',
            definitionId: 'kraken',
            activeOS: 'kraken_v1',
            blueprintsCollected: 0,
            hpIV: 20,
            attackIV: 20,
            defenseIV: 20,
        },
    ];
    return createRun({ seed: 'tips-run-seed', offer, party, startedAt: 0 });
}

// --- The registry --------------------------------------------------------------------------------

describe('the tip registry', () => {
    it('has one entry per id and every id is in ALL_TIP_IDS', () => {
        expect(ALL_TIP_IDS).toHaveLength(TIP_REGISTRY.size);
        for (const id of ALL_TIP_IDS) expect(TIP_REGISTRY.get(id)?.id).toBe(id);
    });

    it('never writes a power figure, a file name or a ticket number at the player', () => {
        // The standing law (map § Notes) plus the plainer rule that a tip is player-facing copy.
        // Ticket 22 found 142 card descriptions breaking the first one; new copy does not get to
        // add the 143rd.
        for (const tip of TIP_REGISTRY.values()) {
            const text = `${tip.title} ${tip.body}`;
            expect(text).not.toMatch(/power/i);
            expect(text).not.toMatch(/ticket/i);
            expect(text).not.toMatch(/\.tsx?\b/);
        }
    });

    it('opens the fight sequence on the matchup, and names the one ranch tip', () => {
        // TICKET 182a: two fight tips remain; the order is still the turn's order.
        expect([...TIP_REGISTRY.keys()].slice(0, 2)).toEqual(['battle:matchup', 'battle:endturn']);
        expect(RANCH_BLUEPRINT_TIP.id).toBe('ranch:blueprints');
    });

    it('is one short line per tip: a toast, not a paragraph (182a)', () => {
        for (const tip of TIP_REGISTRY.values()) {
            expect(tip.body.length, tip.id).toBeLessThanOrEqual(80);
            // One sentence: no full stop followed by another sentence.
            expect(tip.body, tip.id).not.toMatch(/[.!?]\s+[A-Z]/);
        }
    });
});

// --- Battle sequence ------------------------------------------------------------------------------

describe('nextBattleTip', () => {
    /*
     * TICKET 182a: only two fight tips remain, "Elements beat elements" and "End turn refills
     * everyone". Energy, play-a-card and STAB are retired from the order (their ids stay in `TipId`
     * so an old save still parses) because a first fight teaches them by being played.
     */
    const lopsided = (): IBattleState =>
        battle({ player: [entity('kraken', 'p1')], enemy: [entity('fenrir', 'e1')] });

    it('opens on the matchup tip when the field has one', () => {
        expect(nextBattleTip(lopsided(), [])?.id).toBe('battle:matchup');
    });

    it('never offers the three retired tips, whatever is in hand or on the field', () => {
        const stabHand = battle({ hand: [card('hydro_blast')], cardsPlayedThisTurn: 2 });
        const shown = new Set<string>();
        for (const state of [battle(), lopsided(), stabHand]) {
            const tip = nextBattleTip(state, []);
            if (tip) shown.add(tip.id);
        }
        for (const retired of ['battle:energy', 'battle:play', 'battle:stab']) {
            expect(shown.has(retired)).toBe(false);
            expect(TIP_REGISTRY.has(retired as never)).toBe(false);
            expect(ALL_TIP_IDS).not.toContain(retired);
        }
    });

    it('says nothing on a neutral field before a card has been played', () => {
        expect(nextBattleTip(battle(), [])).toBeNull();
    });

    it('says nothing at all while the enemy is acting', () => {
        expect(nextBattleTip({ ...lopsided(), activeSide: 'ENEMY' } as IBattleState, [])).toBeNull();
    });

    it('holds the end-turn tip back until a card has been played this turn', () => {
        const seen = ['battle:matchup'];
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 0 }), seen)).toBeNull();
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 1 }), seen)?.id).toBe('battle:endturn');
    });

    it('offers the end-turn tip even on a neutral field, once a card has been played', () => {
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 1 }), [])?.id).toBe('battle:endturn');
    });

    it('goes quiet once everything has been seen', () => {
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 3 }), [...ALL_TIP_IDS])).toBeNull();
    });

    it('ignores ids in the save that this build has never heard of, and ones it retired', () => {
        // `seenTips` is stored as loose strings on purpose (see `IRanchState.seenTips`), so a save
        // from a build with a retired tip must not throw or shift the sequence.
        expect(nextBattleTip(lopsided(), ['battle:whatever-we-called-it-in-june'])?.id).toBe('battle:matchup');
        expect(nextBattleTip(lopsided(), ['battle:energy', 'battle:play', 'battle:stab'])?.id).toBe('battle:matchup');
    });
});

// --- Map sequence ---------------------------------------------------------------------------------

describe('nextMapTip', () => {
    it('opens on the types tip, then the gym', () => {
        const r = run();
        expect(nextMapTip(r, [])?.id).toBe('map:types');
        expect(nextMapTip(r, ['map:types'])?.id).toBe('map:gym');
    });

    it('holds the workshop tip until a workshop is one step away', () => {
        const r = run();
        const seen = ['map:types', 'map:gym'];

        // Standing on the entry node, whose neighbours are layer 1. Whether one of them is a
        // workshop is a property of the seed, so the test asserts the PREDICATE both ways by moving
        // the run rather than hoping the seed obliges.
        const workshop = r.nodes.find((n) => isWorkshopNode(n.kind));
        expect(workshop).toBeDefined();
        const neighbour = r.nodes.find((n) => n.edges.includes(workshop!.id))!;

        const adjacent: IRunState = { ...r, currentNodeId: neighbour.id };
        expect(nextMapTip(adjacent, seen)?.id).toBe('map:workshop');

        // A node with no workshop neighbour says nothing.
        const far = r.nodes.find(
            (n) => !n.edges.some((id) => r.nodes.find((x) => x.id === id)?.kind === 'workshop'),
        )!;
        expect(nextMapTip({ ...r, currentNodeId: far.id }, seen)).toBeNull();
    });

    /*
     * TICKET 142c. Henry played the first Rootfall run and asked *"I thought I would see nature in
     * the workshop somehow"* — the right instinct at the wrong end of the chain, and proof that 142a
     * shipped a mechanic that never said what it was. These two tips are where it says it.
     */
    it('holds the rival tip until a rival is one step away', () => {
        const r = run();
        const seen = ['map:types', 'map:gym'];
        const rival = r.nodes.find((n) => n.kind === 'rival');
        expect(rival, 'every biome is guaranteed a rival — see REGION_PARAMS').toBeDefined();
        const neighbour = r.nodes.find((n) => n.edges.includes(rival!.id))!;

        // `map:workshop` sits ahead of this in MAP_TIPS, so it has to be marked seen for the
        // sequence to reach the rival — otherwise this asserts the ORDER and not the predicate.
        const withWorkshop = [...seen, 'map:workshop'];
        expect(nextMapTip({ ...r, currentNodeId: neighbour.id }, withWorkshop)?.id).toBe('map:rival');

        const far = r.nodes.find(
            (n) => !n.edges.some((id) => r.nodes.find((x) => x.id === id)?.kind === 'rival')
                && !n.edges.some((id) => r.nodes.find((x) => x.id === id)?.scout),
        )!;
        expect(nextMapTip({ ...r, currentNodeId: far.id }, withWorkshop)).toBeNull();
    });

    it('holds the scout tip until the scout is one step away, and reads the FLAG not a kind', () => {
        // The scout takes over whatever fight was already at that node, so there is no `kind` to
        // match on — this is the first predicate in the game to read `node.scout` at all, which is
        // also why the scout was invisible everywhere until 142c.
        const r = run();
        const seen = ['map:types', 'map:gym', 'map:workshop', 'map:rival'];
        const scout = r.nodes.find((n) => n.scout);
        expect(scout, 'a run has exactly one scout — the last fight before the gauntlet').toBeDefined();
        expect(scout!.kind).not.toBe('scout' as never);
        const neighbour = r.nodes.find((n) => n.edges.includes(scout!.id))!;

        expect(nextMapTip({ ...r, currentNodeId: neighbour.id }, seen)?.id).toBe('map:scout');
        const far = r.nodes.find((n) => !n.edges.some((id) => r.nodes.find((x) => x.id === id)?.scout))!;
        expect(nextMapTip({ ...r, currentNodeId: far.id }, seen)).toBeNull();
    });
    it('goes quiet once everything has been seen', () => {
        expect(nextMapTip(run(), [...ALL_TIP_IDS])).toBeNull();
    });
});
