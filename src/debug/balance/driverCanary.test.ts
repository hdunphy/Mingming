/**
 * The Driver canary's arithmetic, without a battle — the only way its ratios can be given a known
 * answer. The population and the battles themselves are `npm run balance:drivers`.
 */
import { describe, expect, it } from 'vitest';

import { CANARY_ARMS, allPairsOf, armName, elementArmFor, ringOf, summarizeArm, type CanaryBattle } from './driverCanary';
import { REFERENCE_PANEL } from './teamComps';
import { PLAYER_DRIVER_IDS } from '../../engine/data/driverRegistry';

const battle = (over: Partial<CanaryBattle>): CanaryBattle => ({
    arm: 'x', driverId: 'x', matchup: 'a vs b', seed: 's', startingSide: 'PLAYER',
    winner: 'PLAYER', turns: 5, ftk: false, truncated: false, procs: 1,
    ...over,
});

describe('the population', () => {
    it('the ring pairs every panel comp with the next one — six distinct matchups, no mirrors', () => {
        const ring = ringOf(REFERENCE_PANEL);
        expect(ring).toHaveLength(REFERENCE_PANEL.length);
        for (const [a, b] of ring) expect(a.id).not.toBe(b.id);
        expect(new Set(ring.map(([a, b]) => `${a.id}|${b.id}`)).size).toBe(REFERENCE_PANEL.length);
        // Every comp appears exactly once as the DRIVER HOLDER.
        expect(ring.map(([a]) => a.id).sort()).toEqual(REFERENCE_PANEL.map(c => c.id).sort());
    });

    it('--full is the thirty-pair round-robin', () => {
        expect(allPairsOf(REFERENCE_PANEL)).toHaveLength(30);
    });

    it('every arm is a shipped player Driver or the element class', () => {
        for (const arm of CANARY_ARMS) {
            if (arm === 'element') continue;
            expect(PLAYER_DRIVER_IDS).toContain(arm);
        }
        // Seven named + the element class: the ruled eight.
        expect(CANARY_ARMS).toHaveLength(8);
    });

    it('the element arm hands each panel comp a real Element Driver', () => {
        for (const comp of REFERENCE_PANEL) {
            const id = elementArmFor(comp);
            expect(id, comp.id).not.toBeNull();
            expect(PLAYER_DRIVER_IDS).toContain(id);
        }
    });

    it('names its arms', () => {
        expect(armName('bare')).toContain('bare');
        expect(armName('element')).toContain('ELEMENT');
        expect(armName('driver_first_blood')).toBe('FIRST BLOOD');
    });
});

describe('summarizeArm', () => {
    it('pairs flips on (matchup, seed, order) against the bare arm, and counts the silent battles', () => {
        const bare = [
            battle({ arm: 'bare', seed: '1', startingSide: 'PLAYER', winner: 'ENEMY', procs: 0 }),
            battle({ arm: 'bare', seed: '1', startingSide: 'ENEMY', winner: 'PLAYER', procs: 0 }),
            battle({ arm: 'bare', seed: '2', startingSide: 'PLAYER', winner: 'ENEMY', procs: 0 }),
        ];
        const driven = [
            battle({ arm: 'd', seed: '1', startingSide: 'PLAYER', winner: 'PLAYER', procs: 3 }), // flipped to a win
            battle({ arm: 'd', seed: '1', startingSide: 'ENEMY', winner: 'ENEMY', procs: 0 }),  // flipped to a loss, silent
            battle({ arm: 'd', seed: '2', startingSide: 'PLAYER', winner: 'ENEMY', procs: 1 }),  // unchanged
        ];
        const s = summarizeArm('d', driven, bare);
        expect(s.battles).toBe(3);
        expect(s.wins).toBe(1);
        expect(s.flipsToWin).toBe(1);
        expect(s.flipsToLoss).toBe(1);
        expect(s.procsPerBattle).toBeCloseTo(4 / 3);
        expect(s.silentBattles).toBe(1);
        expect(s.sweeps).toEqual([]);
    });

    it('flags a comp the Driver sweeps, and a VOID arm reads as all-silent', () => {
        const bare = [battle({ arm: 'bare', matchup: 'zoo vs control', winner: 'ENEMY', procs: 0 })];
        const dead = [battle({ arm: 'd', matchup: 'zoo vs control', winner: 'PLAYER', procs: 0 })];
        const s = summarizeArm('d', dead, bare);
        expect(s.sweeps).toEqual(['zoo']);
        expect(s.silentBattles).toBe(s.battles);
    });

    it('the bare arm never flips against itself and is never silent', () => {
        const bare = [battle({ arm: 'bare', procs: 0 }), battle({ arm: 'bare', seed: 't', winner: 'ENEMY', procs: 0 })];
        const s = summarizeArm('bare', bare, bare);
        expect(s.flipsToWin + s.flipsToLoss).toBe(0);
        expect(s.silentBattles).toBe(0);
    });
});
