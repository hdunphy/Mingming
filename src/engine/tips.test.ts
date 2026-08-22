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
    FIRST_BATTLE_TIP_ID,
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

    it('names the first battle tip as the onboarding proxy', () => {
        // `RunStart` reads exactly this id to decide whether a run is an onboarding run. If the
        // battle list is ever reordered, this is the assertion that says so out loud.
        expect(FIRST_BATTLE_TIP_ID).toBe('battle:energy');
        expect(RANCH_BLUEPRINT_TIP.id).toBe('ranch:blueprints');
    });
});

// --- Battle sequence ------------------------------------------------------------------------------

describe('nextBattleTip', () => {
    it('opens on energy and moves to the play tip once energy is seen', () => {
        expect(nextBattleTip(battle(), [])?.id).toBe('battle:energy');
        expect(nextBattleTip(battle(), ['battle:energy'])?.id).toBe('battle:play');
    });

    it('says nothing at all while the enemy is acting', () => {
        expect(nextBattleTip(battle({ activeSide: 'ENEMY' }), [])).toBeNull();
    });

    it('holds the STAB tip back until a card in hand could actually STAB', () => {
        const seen = ['battle:energy', 'battle:play'];
        // kraken is Water; `water_slap` is the None-element neutral ("Tackle", deck-archetypes
        // ticket 16), so it cannot STAB for anyone.
        const noStab = battle({ hand: [card('water_slap')] });
        expect(nextBattleTip(noStab, seen)?.id).not.toBe('battle:stab');

        const stab = battle({ hand: [card('hydro_blast')] });
        expect(nextBattleTip(stab, seen)?.id).toBe('battle:stab');
    });

    it('holds the matchup tip back until the field actually has one', () => {
        const seen = ['battle:energy', 'battle:play', 'battle:stab'];
        // Water vs Water is neutral in `ElementalMatrix`, so there is nothing to teach yet.
        const neutral = battle({ player: [entity('kraken', 'p1')], enemy: [entity('kraken', 'e1')] });
        expect(nextBattleTip(neutral, seen)?.id).not.toBe('battle:matchup');

        // Water beats Fire.
        const lopsided = battle({ player: [entity('kraken', 'p1')], enemy: [entity('fenrir', 'e1')] });
        expect(nextBattleTip(lopsided, seen)?.id).toBe('battle:matchup');
    });

    it('holds the end-turn tip back until a card has been played this turn', () => {
        const seen = ['battle:energy', 'battle:play', 'battle:stab', 'battle:matchup'];
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 0 }), seen)).toBeNull();
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 1 }), seen)?.id).toBe('battle:endturn');
    });

    it('skips a tip whose moment has not come and offers a later one that is ready', () => {
        // The order is a priority list, not a queue: nothing is blocked behind a tip that is
        // waiting. Here STAB cannot fire (no matching card) but the matchup can.
        const state = battle({
            hand: [card('water_slap')],
            player: [entity('kraken', 'p1')],
            enemy: [entity('fenrir', 'e1')],
        });
        expect(nextBattleTip(state, ['battle:energy', 'battle:play'])?.id).toBe('battle:matchup');
    });

    it('goes quiet once everything has been seen — including via Skip tips', () => {
        expect(nextBattleTip(battle({ cardsPlayedThisTurn: 3 }), [...ALL_TIP_IDS])).toBeNull();
    });

    it('ignores ids in the save that this build has never heard of', () => {
        // `seenTips` is stored as loose strings on purpose (see `IRanchState.seenTips`), so a save
        // from a build with a retired tip must not throw or shift the sequence.
        expect(nextBattleTip(battle(), ['battle:whatever-we-called-it-in-june'])?.id).toBe('battle:energy');
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
        const workshop = r.nodes.find((n) => n.kind === 'workshop');
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

    it('goes quiet once everything has been seen', () => {
        expect(nextMapTip(run(), [...ALL_TIP_IDS])).toBeNull();
    });
});
