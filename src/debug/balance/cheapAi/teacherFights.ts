/**
 * TICKET 177c — THE FIGHT LIST THE TEACHER IS RECORDED ON.
 *
 * A fight is named by its INDEX, and the index alone rebuilds it (setup, seed, who moves first), so
 * a recording is a list of numbers and 177d can replay any fight it recorded.
 *
 * THE ORDER IS THE POINT. Fights run from index 0 and a recording is usually stopped early, so the
 * list repeats a ten-fight cycle in which every kind of fight turns up, and any prefix is a
 * balanced sample rather than "all the cheap 1v1s first":
 *
 *     slot 0, 1, 2, 3, 9   1v1, one EA starter deck against another (all 132 ordered pairs)
 *     slot 4               1v1, an EA starter against a gym's boss member
 *     slot 5               2v2, two EA starters against two EA starters
 *     slot 6               2v2, two EA starters against two boss members
 *     slot 7               3v3, a team of three EA starters against another
 *     slot 8               3v3, a team of three EA starters against a gym's whole boss team
 *
 * The ticket names the 1v1 EA pairs and "each against each gym's boss fight, 3v3 where the setup
 * allows". The 2v2 slots are an addition: a full 3v3 costs the full AI up to a minute, 2v2 costs a
 * few seconds and is the smallest fight with more than one caster, so the cheap rows of the table
 * keep the teaching data from being all 1v1.
 *
 * The boss is the gym's AUTHORED boss team (`authoredBossFor`, the table `rollGauntletFight` reads
 * for fight 3) with the gym's side-level Driver, built through the same `teamScenario` the 3v3
 * balance grid uses. `rollGauntletFight` itself needs a whole run around it (a map node, a ranch),
 * and for this purpose the enemy team, its decks and its Driver are everything the fight is.
 */

import { LAUNCH_SPECIES, MingmingRegistry } from '../../../engine/data/mingmingRegistry';
import { authoredBossFor } from '../../../engine/run/bosses';
import { matchupScenario, teamScenario } from '../balanceScenarios';
import type { ComposedSetup } from '../../scenarios/scenarioSchema';

export type FightKind = '1v1-ea' | '1v1-boss' | '2v2-ea' | '2v2-boss' | '3v3-ea' | '3v3-boss';

export interface TeacherFightSpec {
    readonly index: number;
    readonly kind: FightKind;
    readonly name: string;
    readonly setup: ComposedSetup;
    readonly seed: string;
    readonly startingSide: 'PLAYER' | 'ENEMY';
}

type Member = readonly [species: string, os: string];

/** The EA twelve in registry order. */
const STARTERS: ReadonlyArray<Member> = LAUNCH_SPECIES.flatMap(
    (species) => (MingmingRegistry[species]?.availableOS ?? []).map((os) => [species, os] as const),
);

const GYMS = ['gym_emberfall', 'gym_tidewrack', 'gym_rootfall'] as const;

/** 10-fight cycle: which kind each slot is. */
const CYCLE: ReadonlyArray<FightKind> = [
    '1v1-ea', '1v1-ea', '1v1-ea', '1v1-ea', '1v1-boss',
    '2v2-ea', '2v2-boss', '3v3-ea', '3v3-boss', '1v1-ea',
];

/** Fights in one repeat of the cycle. */
export const CYCLE_LENGTH = CYCLE.length;

/**
 * Which shard records fight `index`. Plain `index % shards` would hand one shard every even slot of
 * the cycle for ever (and so every 3v3 team-v-team fight to one process and every boss 3v3 to the
 * other); adding the round number rotates the slots between shards each cycle, so each shard sees
 * every kind and the two finish together.
 */
export function shardOf(index: number, shards: number): number {
    return (index + Math.floor(index / CYCLE_LENGTH)) % shards;
}

/** A small stable integer hash, for choices that should look scattered but never change. */
function mix(a: number, b: number): number {
    let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return (h ^ (h >>> 12)) >>> 0;
}

/** `count` members of DIFFERENT species, starting from a hash-chosen species and OS. */
function team(count: number, salt: number): Member[] {
    const start = mix(salt, 1) % LAUNCH_SPECIES.length;
    const members: Member[] = [];
    for (let j = 0; j < count; j += 1) {
        const species = LAUNCH_SPECIES[(start + j) % LAUNCH_SPECIES.length];
        const options = MingmingRegistry[species].availableOS;
        members.push([species, options[mix(salt, 2 + j) % options.length]]);
    }
    return members;
}

function bossFor(gymId: string, count: number, salt: number): { members: Member[]; driver: string } {
    const boss = authoredBossFor(gymId);
    if (!boss) throw new Error(`[teacherFights] ${gymId} has no authored boss.`);
    // Fewer than three: a rotating window over the boss's line-up.
    const offset = count === boss.members.length ? 0 : mix(salt, 7) % boss.members.length;
    const members = Array.from({ length: count }, (_, j) => {
        const m = boss.members[(offset + j) % boss.members.length];
        return [m.species, m.os] as Member;
    });
    return { members, driver: boss.driver };
}

const label = (members: ReadonlyArray<Member>): string => members.map(([, os]) => os).join('+');

/** The fight at `index`. Pure and total: any non-negative integer names a fight. */
export function teacherFight(index: number): TeacherFightSpec {
    const kind = CYCLE[index % CYCLE.length];
    const round = Math.floor(index / CYCLE.length);
    const seed = `teacher177:${index}`;
    const startingSide: 'PLAYER' | 'ENEMY' = mix(index, 3) % 2 === 0 ? 'PLAYER' : 'ENEMY';
    const gymId = GYMS[(round + (index % CYCLE.length)) % GYMS.length];

    if (kind === '1v1-ea') {
        // 132 ordered pairs, walked in order: slots 0-3 and 9 are five per cycle.
        const nth = round * 5 + (index % CYCLE.length === 9 ? 4 : index % CYCLE.length);
        const pair = nth % (STARTERS.length * (STARTERS.length - 1));
        const a = Math.floor(pair / (STARTERS.length - 1));
        const bRaw = pair % (STARTERS.length - 1);
        const b = bRaw >= a ? bRaw + 1 : bRaw;
        const [player, playerOS] = STARTERS[a];
        const [enemy, enemyOS] = STARTERS[b];
        return {
            index, kind, seed, startingSide,
            name: `1v1 ${playerOS} v ${enemyOS}`,
            setup: { ...matchupScenario({ player, playerOS, enemy, enemyOS, seed }), seed },
        };
    }

    if (kind === '1v1-boss') {
        const starter = STARTERS[round % STARTERS.length];
        const boss = bossFor(gymId, 1, index);
        const [player, playerOS] = starter;
        const [enemy, enemyOS] = boss.members[0];
        return {
            index, kind, seed, startingSide,
            name: `1v1 ${playerOS} v ${gymId} boss member ${enemyOS}`,
            setup: { ...matchupScenario({ player, playerOS, enemy, enemyOS, seed }), seed, enemyDrivers: [boss.driver] },
        };
    }

    const size = kind.startsWith('2v2') ? 2 : 3;
    const mine = team(size, index);
    if (kind.endsWith('-ea')) {
        const theirs = team(size, index + 100_000);
        return {
            index, kind, seed, startingSide,
            name: `${size}v${size} ${label(mine)} v ${label(theirs)}`,
            setup: teamScenario({ player: mine, enemy: theirs, seed }),
        };
    }
    const boss = bossFor(gymId, size, index);
    return {
        index, kind, seed, startingSide,
        name: `${size}v${size} ${label(mine)} v ${gymId} boss ${label(boss.members)}`,
        setup: { ...teamScenario({ player: mine, enemy: boss.members, seed }), enemyDrivers: [boss.driver] },
    };
}
