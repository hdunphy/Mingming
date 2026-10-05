/**
 * TICKET 193 follow-up — A MIRROR FIGHT'S COMBAT LOG SAYS WHICH KRAKEN IS WHICH.
 *
 * The log writes units by name only, so Kraken against Kraken read `→ Kraken takes 706 damage` with
 * no way to tell the player's unit from the foe. Three playtest agents asked whether their Kraken was
 * hitting itself (ticket 193f fixed that in the tool's hit table; this is the game's own log).
 * An enemy that shares a name with a party member is named `Kraken (foe)` when the battle is built, so
 * every line the engine writes, and every name on the board, tells them apart. A fight between
 * different species is untouched.
 */
import { describe, expect, it } from 'vitest';
import { getBestAction } from '../ai/TacticalAI';
import { battleReducer } from '../battleReducer';
import { createMingmingInstance } from '../gameTypes';
import { initializeBattleEntity } from '../types';
import { GetMingmingData } from './mingmingRegistry';
import { createBattleState, type IBattleSetup } from './battleFactories';
import { tagMirrorFoes } from './mirrorNames';

const entity = (id: string) => initializeBattleEntity(createMingmingInstance(id), GetMingmingData(id));

describe('tagMirrorFoes', () => {
    it('tags an enemy that shares a name with a party member, and only that one', () => {
        const party = [entity('kraken')];
        const foes = [entity('kraken'), entity('fenrir')];
        const tagged = tagMirrorFoes(party, foes);
        expect(tagged.map((e) => e.name)).toEqual([`${party[0].name} (foe)`, foes[1].name]);
        // everything else about the body is untouched
        expect(tagged[0]).toEqual({ ...foes[0], name: `${foes[0].name} (foe)` });
        expect(tagged[1]).toBe(foes[1]);
    });

    it('leaves a fight between different species exactly as it was, and tagging twice changes nothing more', () => {
        const party = [entity('kraken')];
        const foes = [entity('fenrir')];
        expect(tagMirrorFoes(party, foes)).toEqual(foes);
        const once = tagMirrorFoes(party, [entity('kraken')]);
        expect(tagMirrorFoes(party, once)).toEqual(once);
    });
});

describe('createBattleState — a mirror fight', () => {
    const setupFor = (enemyId: string): IBattleSetup => {
        const kraken = createMingmingInstance('kraken');
        return {
            party: [kraken], deck: Array(8).fill('tackle'), drivers: [], persistedHp: {},
            encounter: { enemyParty: [entity(enemyId)], enemyDeckIds: [] },
        };
    };

    it('names the foe apart from the party member on the board', () => {
        const state = createBattleState(setupFor('kraken'), [], undefined, { seed: 'mirror', enemyMode: 'CARDS' });
        const mine = state.playerParty[0].name;
        expect(state.enemyParty[0].name).toBe(`${mine} (foe)`);
    });

    it('so the combat log line for a hit on the foe says so', () => {
        let state = createBattleState(setupFor('kraken'), [], undefined, { seed: 'mirror', enemyMode: 'CARDS' });
        const mine = state.playerParty[0].name;
        for (let i = 0; i < 12 && !state.logs.some((l) => l.includes('takes')); i += 1) {
            state = battleReducer(state, getBestAction(state));
        }
        const hit = state.logs.find((l) => /→ .* takes \d+ damage/.test(l));
        expect(hit, state.logs.join('\n')).toBeDefined();
        expect(hit).toContain(`${mine} (foe)`);
    });

    it('a fight between different species keeps the plain names', () => {
        const state = createBattleState(setupFor('fenrir'), [], undefined, { seed: 'plain', enemyMode: 'CARDS' });
        expect(state.enemyParty[0].name).toBe(GetMingmingData('fenrir').name);
    });
});
