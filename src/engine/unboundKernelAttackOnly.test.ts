/**
 * TICKET 185a — only ATTACK cards feed fenrir_v1's UNBOUND_KERNEL.
 *
 * Henry's Rootfall run (2026-10-02): the firmware says "Attack programs apply 2 Strengthened",
 * but the hook asked `actionType: "ATTACK"`, which the validator reads as "does the card have an
 * ATTACK action ANYWHERE". Forage's "take damage equal to 15 power" is an ATTACK action aimed at
 * yourself, so a 0-energy Forage paid a draw AND 2 Strength (4 with AMPLIFIER). Henry's ruling:
 * *"No"* — Forage does not count; Attack cards only.
 *
 * The fix is data: `programCategoryIn: ["Attack"]` on both hooks, a condition the engine already
 * has. These tests drive the real reducer with the real card data.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import { PATCHES, PATCH_IDS, applyPatchToFirmware, type PatchId } from './data/patchRegistry';
import { rawFirmwareHooks } from './data/firmwareRegistry';
import type { IBattleState, IBattleEntity } from './types';

const FRAME = 1000;

function unit(id: string, name: string, activeOS?: string, patch?: PatchId): IBattleEntity {
    return createSparseEntity({
        id, name, activeOS, ...(patch ? { patches: [patch] } : {}),
        currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
    });
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

function play(opts: {
    playerOS: Array<string | undefined>,
    patches?: Array<PatchId | undefined>,
    dataId: string,
    casterId: string,
    targetId: string,
}): IBattleState {
    const deck = {
        ownerId: 'PLAYER',
        deck: [], drawpile: [], discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId: opts.dataId, currentCost: GetProgramData(opts.dataId).baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: opts.playerOS.map((os, i) => unit(`p${i + 1}`, `Ally ${i + 1}`, os, opts.patches?.[i])),
        enemyParty: [unit('e1', 'Foe 1')],
        playerDeck: deck,
        enemyDeck: empty,
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: opts.casterId, targetId: opts.targetId, programId: 'h1' },
    } as never);
}

describe('185a — Forage does not feed UNBOUND_KERNEL', () => {
    it('his own Forage gives him no Strength', () => {
        const state = play({ playerOS: ['fenrir_v1'], dataId: 'forage', casterId: 'p1', targetId: 'p1' });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });

    it('an ally\'s Forage gives him no Strength either', () => {
        const state = play({ playerOS: ['fenrir_v1', undefined], dataId: 'forage', casterId: 'p2', targetId: 'p2' });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });

    it('his own Forage with AMPLIFIER still gives nothing', () => {
        const state = play({
            playerOS: ['fenrir_v1'], patches: ['amplifier'],
            dataId: 'forage', casterId: 'p1', targetId: 'p1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });
});

describe('185a — Attack cards still feed it', () => {
    it('his own Tackle gives 2 Strength (1 from each hook)', () => {
        const state = play({ playerOS: ['fenrir_v1'], dataId: 'tackle', casterId: 'p1', targetId: 'e1' });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(2);
    });

    it('his own Tackle with AMPLIFIER gives 4', () => {
        const state = play({
            playerOS: ['fenrir_v1'], patches: ['amplifier'],
            dataId: 'tackle', casterId: 'p1', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(4);
    });

    it('an ally\'s Tackle gives him 1, and 2 with AMPLIFIER', () => {
        const plain = play({ playerOS: ['fenrir_v1', undefined], dataId: 'tackle', casterId: 'p2', targetId: 'e1' });
        expect(stacks(plain.playerParty[0], 'Strengthened')).toBe(1);
        const amped = play({
            playerOS: ['fenrir_v1', undefined], patches: ['amplifier', undefined],
            dataId: 'tackle', casterId: 'p2', targetId: 'e1',
        });
        expect(stacks(amped.playerParty[0], 'Strengthened')).toBe(2);
    });

    it('Glass Cannon (two ATTACK actions) gives 2 once, not once per attack action', () => {
        const state = play({ playerOS: ['fenrir_v1'], dataId: 'glass_cannon', casterId: 'p1', targetId: 'e1' });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(2);
    });
});

describe('185a — the patch transforms carry the new condition through', () => {
    type CondHook = { id: string; when?: { programCategoryIn?: string[] } };

    it('every patched fenrir_v1 hook still asks for the Attack category', () => {
        const raw = rawFirmwareHooks('fenrir_v1');
        for (const patchId of PATCH_IDS) {
            const patched = applyPatchToFirmware('fenrir_v1', PATCHES[patchId], raw) as ReadonlyArray<CondHook>;
            for (const hook of patched.filter(h => h.id.startsWith('fenrir_v1_hook') || h.id === 'fenrir_v1_ally_hook')) {
                expect(hook.when?.programCategoryIn, `${patchId} / ${hook.id}`).toEqual(['Attack']);
            }
        }
    });

    it('SPLITTER leaves the host alone and still only pays on Attack cards (184e)', () => {
        const forage = play({
            playerOS: ['fenrir_v1', undefined], patches: ['splitter', undefined],
            dataId: 'forage', casterId: 'p1', targetId: 'p1',
        });
        expect(stacks(forage.playerParty[0], 'Strengthened')).toBe(0);
        expect(stacks(forage.playerParty[1], 'Strengthened')).toBe(0);
    });
});
