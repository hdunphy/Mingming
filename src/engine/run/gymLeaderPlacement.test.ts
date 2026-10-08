/**
 * TICKET 207 — the authored gym teams in fights 1 and 2, and what the leader fights with.
 *
 * Henry, 2026-10-08: each of the leader's three Instincts appears at least once across fights 1
 * and 2, carrying its leader card (added to the enemy's usual deck), and no fight there holds the
 * leader's whole trio, so fight 3 stays the hardest. The leader itself fights with its authored deck
 * plus its leader card. These are swept across seeds and all three gyms, because "at least once"
 * and "never all three" are guarantees, not tendencies.
 */
import { describe, expect, it } from 'vitest';

import type { IBiome } from '../runTypes';
import type { IMingmingState } from '../types';
import { codexCardIds } from '../codex';
import { inV2RunPool } from '../RewardSystem';
import { AUTHORED_BOSSES, authoredBossFor, leaderDeckFor } from './bosses';
import { createRun } from './createRun';
import { GAUNTLET_FIGHTS, rollGauntletFight } from './gauntlet';
import { leaderPlacement } from './gymLeaderPlacement';
import { GYM_REGISTRY } from './gyms';
import { leaderDriverFor } from './tiers/tierRegistry';

const BIOMES: ReadonlyArray<IBiome> = [
    { id: 'biome_water', name: 'Water', elements: ['Water'] },
    { id: 'biome_nature', name: 'Nature', elements: ['Nature', 'Fire'] },
    { id: 'biome_fire', name: 'Fire', elements: ['Fire'] },
];
const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', nickname: 'Inky', activeOS: 'kraken_v1',
    blueprintsCollected: 0, hpIV: 10, attackIV: 10, defenseIV: 10,
};
const GYMS = ['gym_emberfall', 'gym_tidewrack', 'gym_rootfall'] as const;
const SEEDS = Array.from({ length: 12 }, (_, i) => `t207-${i}`);

const runAt = (gymId: (typeof GYMS)[number], seed: string) => {
    const run = createRun({ seed, offer: { gym: GYM_REGISTRY[gymId], biomes: BIOMES }, party: [MEMBER], startedAt: 0 });
    const node = { ...run.nodes.find((n) => n.kind === 'gym')!, visited: 1 };
    return { run, node };
};

describe('207 — the leader fights with its authored deck and its leader card', () => {
    it.each(GYMS)('%s: fight 3 is the authored trio, each holding its list plus its leader card', (gymId) => {
        const { run, node } = runAt(gymId, 't207-boss');
        const fight = rollGauntletFight({ run, node, fightIndex: GAUNTLET_FIGHTS - 1 });
        const boss = authoredBossFor(gymId)!;
        expect(fight.enemyParty.map((e) => e.activeOS)).toEqual(boss.members.map((m) => m.os));
        expect([...fight.enemyDeckIds]).toEqual(boss.members.flatMap((m) => leaderDeckFor(m)));
    });

    it('every authored deck is 10 cards, no card more than twice, and the leader card is not in it', () => {
        for (const boss of Object.values(AUTHORED_BOSSES)) {
            for (const member of boss.members) {
                expect(member.deck, member.os).toHaveLength(10);
                for (const id of new Set(member.deck)) {
                    expect(member.deck.filter((x) => x === id).length, `${member.os} ${id}`).toBeLessThanOrEqual(2);
                }
                expect(member.deck).not.toContain(member.leaderCard);
            }
        }
    });

    it('leader cards are enemy-only: outside the run pool and the codex', () => {
        const codex = new Set(codexCardIds());
        for (const boss of Object.values(AUTHORED_BOSSES)) {
            for (const member of boss.members) {
                expect(inV2RunPool(member.leaderCard), member.leaderCard).toBe(false);
                expect(codex.has(member.leaderCard), member.leaderCard).toBe(false);
            }
        }
        expect(inV2RunPool('eitr_surge')).toBe(false);
    });

    it('the tier table names the same Driver the gym fields (ÉLIVÁGAR at Tidewrack, YGGDRASIL\'S WRATH at Rootfall)', () => {
        for (const gymId of GYMS) expect(leaderDriverFor(gymId), gymId).toBe(authoredBossFor(gymId)!.driver);
    });
});

describe('207 — fights 1 and 2 show every leader Instinct, never the whole trio', () => {
    it.each(GYMS)('%s: each leader Instinct once across fights 1 and 2, with its leader card', (gymId) => {
        const boss = authoredBossFor(gymId)!;
        for (const seed of SEEDS) {
            const { run, node } = runAt(gymId, seed);
            const seen: string[] = [];
            for (const fightIndex of [0, 1]) {
                const fight = rollGauntletFight({ run, node, fightIndex });
                const leaders = fight.enemyParty.filter((e) => boss.members.some((m) => m.os === e.activeOS));
                // Never the whole trio in one fight: fight 3 is the only place the three play together.
                expect(leaders.length, `${seed} fight ${fightIndex + 1}`).toBeLessThan(boss.members.length);
                expect(leaders.length, `${seed} fight ${fightIndex + 1}`).toBeGreaterThan(0);
                for (const enemy of leaders) {
                    const member = boss.members.find((m) => m.os === enemy.activeOS)!;
                    expect(enemy.definitionId).toBe(member.species);
                    expect(fight.enemyDeckIds, `${seed} ${member.os}`).toContain(member.leaderCard);
                    seen.push(member.os);
                }
                // The fights 1 and 2 rung keeps its rolled IVs and carries no Driver at tier 0.
                expect(fight.enemyDrivers).toBeUndefined();
            }
            expect([...seen].sort(), seed).toEqual(boss.members.map((m) => m.os).sort());
        }
    });

    it('is decided once per gym visit, so fight 2 agrees with fight 1 about what is left', () => {
        const { run, node } = runAt('gym_rootfall', 't207-agree');
        expect(leaderPlacement(run, node)).toEqual(leaderPlacement(run, node));
        const [first, second] = leaderPlacement(run, node);
        expect([...first, ...second].sort()).toEqual([0, 1, 2]);
        expect(new Set([first.length, second.length])).toEqual(new Set([1, 2]));
    });

    it('rolls the same fights twice from the same seed', () => {
        const { run, node } = runAt('gym_emberfall', 't207-twice');
        for (const fightIndex of [0, 1]) {
            expect(rollGauntletFight({ run, node, fightIndex })).toEqual(rollGauntletFight({ run, node, fightIndex }));
        }
    });
});
