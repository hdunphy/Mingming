/**
 * TICKET 170c — the death digest, on hand-made walks. The real walking is in `walkerDeaths.balance.ts`.
 */
import { describe, expect, it } from 'vitest';

import { appendRunEvent, emptyRunLog } from '../../engine/run/runLog';
import type { IRunLog } from '../../engine/run/runLog';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import { deathDigest, formatDeathReport, summariseByStarter, summariseDeaths } from './walkerDeaths';
import type { DeathDigest, DeathInput } from './walkerDeaths';
import { walkRun } from './runWalker';

type Fight = DeathInput['fights'][number];
const fight = (index: number, kind: string, won: boolean, extra: Partial<Fight> = {}): Fight => ({
    index, nodeId: `n${index}`, kind: kind as Fight['kind'], biome: 0, deckSize: 12, deckPower: 50, won, turns: 4,
    truncated: false, survivors: [{ osId: 'os', hpFraction: won ? 0.5 : 0 }], ...extra,
});

const logWithEnemies = (rows: Array<[number, string, string[]]>): IRunLog => {
    let log = emptyRunLog('seed', 0);
    let seq = 0;
    for (const [fightIndex, nodeKind, species] of rows) {
        log = appendRunEvent(log, {
            kind: 'FIGHT_DECK', deck: [], party: [], enemies: species.map((s) => ({ species: s, osId: null })), nodeKind: nodeKind as 'wild', biome: 0,
        }, { seq: seq++, fightIndex, deckSize: 12, scrap: 0 });
    }
    return log;
};

const walk = (fights: Fight[], over: Partial<DeathInput> = {}): DeathInput => ({
    seed: 's', starter: 'fenrir_v2', outcome: 'defeat', fights, finalDeck: ['a', 'b', JUNK_CARD_ID], scrapAtEnd: 30,
    recruits: [], benchesMissed: 2, patchShelvesSeen: 1, patches: [], upgraded: [], log: emptyRunLog('s', 0), ...over,
});

describe('deathDigest', () => {
    it('puts a walk that lost before the gym in the before-gym bucket, and names the killer', () => {
        const input = walk(
            [fight(1, 'wild', true), fight(2, 'wild', true), fight(3, 'elite', false, { turns: 7, biome: 1 })],
            { log: logWithEnemies([[3, 'elite', ['kraken_v1']]]) },
        );
        const digest = deathDigest(input);
        expect(digest.bucket).toBe('before-gym');
        expect(digest.fightsWon).toBe(2);
        expect(digest.killer).toMatchObject({ kind: 'elite', biome: 1, gauntletIndex: 0, turns: 7, partyHpAtStart: 1, enemySpecies: ['kraken_v1'] });
        expect(digest.killer?.enemyElements).toHaveLength(1);
        expect(digest.junkCards).toBe(1);
        expect(digest.deckSize).toBe(3);
        expect(digest.scrapAtEnd).toBe(30);
    });

    it('puts a walk that reached the gym and lost in its own bucket, with the gauntlet fight and the HP it carried', () => {
        const input = walk([
            fight(1, 'wild', true), fight(2, 'gym', true, { survivors: [{ osId: 'a', hpFraction: 0.6 }, { osId: 'b', hpFraction: 0.2 }] }),
            fight(3, 'gym', false),
        ]);
        const digest = deathDigest(input);
        expect(digest.bucket).toBe('gauntlet');
        expect(digest.killer).toMatchObject({ kind: 'gym', gauntletIndex: 2 });
        expect(digest.killer?.partyHpAtStart).toBeCloseTo(0.4);
    });

    it('gives a full clear no killer and no death bucket', () => {
        const digest = deathDigest(walk([fight(1, 'wild', true), fight(2, 'gym', true), fight(3, 'gym', true), fight(4, 'gym', true)], { outcome: 'victory' }));
        expect(digest.bucket).toBe('cleared');
        expect(digest.killer).toBeNull();
        expect(summariseDeaths([digest])).toMatchObject({ cleared: 1, diedBeforeGym: 0, diedInGauntlet: 0, fightsWonBeforeDying: [], killerKinds: {} });
    });

    it('calls a walk that ended without a loss and without a clear stalled, not dead', () => {
        expect(deathDigest(walk([fight(1, 'wild', true)])).bucket).toBe('stalled');
        expect(deathDigest(walk([])).bucket).toBe('stalled');
    });

    it('counts the party as the starter plus its recruits, and reads unused blueprints off the leftovers', () => {
        const digest = deathDigest(walk([fight(1, 'wild', false)], { recruits: [{}, {}] as unknown as DeathInput['recruits'], leftovers: { blueprintsHeld: 2 } }));
        expect(digest.partySize).toBe(3);
        expect(digest.blueprintsHeld).toBe(2);
    });
});

const digestOf = (starter: string, bucket: DeathDigest['bucket'], fightsWon: number, kind: string | null, extra: Partial<DeathDigest> = {}): DeathDigest => ({
    starter, seed: 's', bucket, fightsWon,
    killer: kind === null ? null : {
        kind, biome: kind === 'elite' ? 1 : 0, gauntletIndex: bucket === 'gauntlet' ? 1 : 0,
        enemySpecies: ['x'], enemyElements: ['Fire'], turns: 4, partyHpAtStart: 1,
    },
    deckSize: 10, deckPower: 40, junkCards: 0, scrapAtEnd: 30, partySize: 1, blueprintsHeld: 0, benchesMissed: 0, upgradesBought: 0,
    patchShelvesSeen: 0, shopPatches: 0, ...extra,
});

describe('summariseDeaths', () => {
    const digests = [
        digestOf('fenrir_v2', 'before-gym', 0, 'wild'),
        digestOf('fenrir_v2', 'before-gym', 2, 'elite'),
        digestOf('fenrir_v2', 'before-gym', 2, 'elite'),
        digestOf('fenrir_v2', 'gauntlet', 9, 'gym'),
        digestOf('kraken_v1', 'cleared', 12, null),
        digestOf('kraken_v1', 'stalled', 3, null),
    ];
    const summary = summariseDeaths(digests);

    it('counts the buckets apart', () => {
        expect(summary).toMatchObject({ walks: 6, cleared: 1, stalled: 1, diedBeforeGym: 3, diedInGauntlet: 1 });
    });

    it('counts before-gym deaths by fights won, with the gaps filled in, and leaves the gym bucket out', () => {
        expect(summary.fightsWonBeforeDying).toEqual([{ fightsWon: 0, walks: 1 }, { fightsWon: 1, walks: 0 }, { fightsWon: 2, walks: 2 }]);
    });

    it('counts which node kind killed the walk, the gauntlet fight, and the biome', () => {
        expect(summary.killerKinds).toEqual({ wild: 1, elite: 2, gym: 1 });
        expect(summary.gauntletDeaths).toEqual([1, 0, 0]);
        expect(summary.killers.byBiome).toEqual({ 0: 2, 1: 2 });
        expect(summary.killers.byElement).toEqual({ Fire: 4 });
    });

    it('does not let a cleared or stalled walk into the death means', () => {
        expect(summary.atDeath.meanScrap).toBe(30);
        expect(summary.atDeath.pctScrapAtLeast).toEqual([{ floor: 25, pct: 100 }, { floor: 45, pct: 0 }]);
    });

    it('splits by starter in order of first appearance', () => {
        const rows = summariseByStarter(digests);
        expect(rows.map((row) => row.starter)).toEqual(['fenrir_v2', 'kraken_v1']);
        expect(rows[0].summary.diedBeforeGym).toBe(3);
        expect(rows[1].summary.cleared).toBe(1);
    });
});

describe('formatDeathReport', () => {
    it('never prints NaN, undefined or Infinity, even with no walks at all', () => {
        for (const digests of [[], [digestOf('kraken_v1', 'cleared', 12, null)], [digestOf('kraken_v1', 'stalled', 0, null)]]) {
            expect(formatDeathReport(digests)).not.toMatch(/NaN|undefined|Infinity/);
        }
    });

    it('prints the buckets and a row per starter', () => {
        const report = formatDeathReport([digestOf('fenrir_v2', 'before-gym', 2, 'elite'), digestOf('kraken_v1', 'gauntlet', 9, 'gym')]);
        expect(report).toContain('| Died on the way to the gym | 1 |');
        expect(report).toContain('| fenrir_v2 | 1 | 0 | 0 | 1 | 2.00 | elite 1 |');
        expect(report).toContain('| kraken_v1 | 1 | 0 | 1 | 0 | - | gym 1 |');
    });
});

describe('170c — the walker reports what it still held, only when asked', () => {
    const SEED = { seed: 't170a:default:fenrir_v2:1', starter: 'fenrir_v2', gymIndex: 1 };
    it('adds leftovers on request and not otherwise', () => {
        expect(walkRun(SEED)).not.toHaveProperty('leftovers');
        const result = walkRun({ ...SEED, reportLeftovers: true });
        expect(result.leftovers?.blueprintsHeld).toBeGreaterThanOrEqual(0);
        const { leftovers: _ignored, ...rest } = result;
        expect(JSON.stringify(rest)).toBe(JSON.stringify(walkRun(SEED)));
    });
});
