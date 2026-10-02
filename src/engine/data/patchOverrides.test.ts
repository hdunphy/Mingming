/**
 * TICKET 184d — Henry's per-firmware patch rulings (2026-10-01), played through the real reducer.
 *
 * *"amplifier -> draw 2 cards, repeater -> draw cards on the 3rd and 5th water cards, splitter ->
 * any element not just water"* (OUROBOROS_LOOP). *"Fenrir_V1 Relay should be ignored. Splitter
 * doesn't double up on Fenrir_V1, he stays the same allies just gain the stacks too. same for
 * Fenrir_v2 splitter and skoll_v1 splitter. Rat_v1 go to 12 power."*
 */
import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import { PATCHES, applyPatchToFirmware, patchDoesNothing } from './patchRegistry';
import { offerablePatchIds } from './patchRanking';
import { rawFirmwareHooks } from './firmwareRegistry';
import type { IBattleState, ProgramEntity } from '../types';

let nextId = 0;

function arena(party: Array<{ species: string; os: string; patches?: string[] }>): IBattleState {
    const setups = party.map((m) => matchupScenario({ player: m.species, enemy: 'kraken', playerOS: m.os, enemyOS: 'kraken_v2', seed: 'overrides-184d' }));
    const setup = { ...setups[0], player: { ...setups[0].player, party: setups.flatMap((s) => s.player.party) } };
    const state = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    return {
        ...state,
        activeSide: 'PLAYER',
        playerParty: state.playerParty.map((e, i) => ({ ...e, patches: party[i]?.patches ?? [] })),
    } as IBattleState;
}

function play(state: IBattleState, dataId: string, casterIndex = 0): IBattleState {
    const card: ProgramEntity = { id: `o184_${nextId++}`, dataId, currentCost: 0, isPlayable: true };
    return battleReducer({
        ...state,
        playerDeck: { ...state.playerDeck, hand: [...state.playerDeck.hand, card] },
        playerParty: state.playerParty.map((e) => ({ ...e, currentEnergy: 50 })),
    } as IBattleState, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: state.playerParty[casterIndex].id, programId: card.id, targetId: state.enemyParty[0].id },
    } as never) as IBattleState;
}

/** Which plays (1-based) made OUROBOROS_LOOP fire, and how many cards each of those plays drew. */
function ouroboros(patches: string[], cards: string[]): Array<{ card: number; drew: number }> {
    let state = arena([{ species: 'jormungandr', os: 'jormungandr_v1', patches }]);
    const fires: Array<{ card: number; drew: number }> = [];
    cards.forEach((dataId, i) => {
        const before = state.logs.length;
        const handBefore = state.playerDeck.hand.length;
        state = play(state, dataId);
        if (state.logs.slice(before).some((l) => l.includes('OUROBOROS_LOOP triggers'))) {
            // `play` adds the card to the hand and plays it (net 0); Undertow draws 1 itself; the
            // rest is the OS.
            const own = dataId === 'undertow' ? 1 : 0;
            fires.push({ card: i + 1, drew: state.playerDeck.hand.length - handBefore - own });
        }
    });
    return fires;
}

const WATER = Array(10).fill('undertow');

describe('184d — OUROBOROS_LOOP (jormungandr_v1)', () => {
    it('unpatched: the 5th Water card draws 1, once', () => {
        expect(ouroboros([], WATER)).toEqual([{ card: 5, drew: 1 }]);
    });

    it('AMPLIFIER: the 5th Water card draws 2 (it used to switch the firmware off)', () => {
        expect(ouroboros(['amplifier'], WATER)).toEqual([{ card: 5, drew: 2 }]);
    });

    it('REPEATER: the 3rd and the 5th Water card each draw, and nothing after (it used to be unlimited)', () => {
        expect(ouroboros(['repeater'], WATER)).toEqual([{ card: 3, drew: 1 }, { card: 5, drew: 1 }]);
    });

    it('SPLITTER: any element counts — five Tackles draw on the 5th (it used to switch the firmware off)', () => {
        expect(ouroboros(['splitter'], Array(10).fill('tackle'))).toEqual([{ card: 5, drew: 1 }]);
        expect(ouroboros([], Array(10).fill('tackle'))).toEqual([]);
    });
});

describe('184d — GOSSIP_NODE (ratatoskr_v1) AMPLIFIER is 12 power', () => {
    it('the heal action goes 10 -> 12 power, not 11', () => {
        const hooks = applyPatchToFirmware('ratatoskr_v1', PATCHES.amplifier, rawFirmwareHooks('ratatoskr_v1'));
        const heal = (hooks[0] as { do?: Array<{ type: string; power?: number }> }).do?.find((a) => a.type === 'HEAL');
        expect(heal?.power).toBe(12);
    });

    it('heals 1.2x as much in play', () => {
        const healed = (patches: string[]) => {
            const base = arena([{ species: 'ratatoskr', os: 'ratatoskr_v1', patches }]);
            const hurt = { ...base, playerParty: base.playerParty.map((e) => ({ ...e, currentHp: Math.floor(e.maxHp / 2) })) } as IBattleState;
            const after = play(hurt, 'tackle');
            return after.playerParty[0].currentHp - hurt.playerParty[0].currentHp;
        };
        const plain = healed([]);
        expect(plain).toBeGreaterThan(0);
        expect(healed(['amplifier']) / plain).toBeCloseTo(1.2, 1);
    });
});

describe('184d — UNBOUND_KERNEL (fenrir_v1): RELAY is not offered', () => {
    it('is hidden from every door', () => {
        expect(patchDoesNothing(PATCHES.relay, 'fenrir_v1', rawFirmwareHooks('fenrir_v1'))).toBe(true);
        expect(offerablePatchIds('fenrir_v1')).not.toContain('relay');
    });
});

describe('184 — SPLITTER gives the REST of the side the stacks; the host is unchanged', () => {
    const strOf = (s: IBattleState, i: number) => s.playerParty[i].statusEffects.find((x) => x.type === 'Strengthened')?.stacks ?? 0;

    it('fenrir_v1: his own attack still gives him 2, and the ally gains 2', () => {
        const plain = play(arena([{ species: 'fenrir', os: 'fenrir_v1' }, { species: 'skoll', os: 'skoll_v2' }]), 'tackle');
        const split = play(arena([{ species: 'fenrir', os: 'fenrir_v1', patches: ['splitter'] }, { species: 'skoll', os: 'skoll_v2' }]), 'tackle');
        expect(strOf(split, 0)).toBe(strOf(plain, 0));
        expect(strOf(plain, 1)).toBe(0);
        expect(strOf(split, 1)).toBe(2);
    });

    it('every SPLITTER echo on the launch firmware is aimed at OTHER_ALLIES, never back at the host', () => {
        for (const os of ['fenrir_v1', 'fenrir_v2', 'skoll_v1']) {
            const hooks = applyPatchToFirmware(os, PATCHES.splitter, rawFirmwareHooks(os));
            const targets = hooks.flatMap((h) => ((h as { do?: Array<{ target?: string }> }).do ?? []).map((a) => a.target));
            expect(targets, os).toContain('OTHER_ALLIES');
            expect(targets, os).not.toContain('ALLIES');
        }
    });
});
