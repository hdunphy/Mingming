/**
 * TICKET 177a — THE TWENTY FIXED FIGHTS the AI's byte-identity is proved on.
 *
 * The shipped search AI (`greedy`, `lite`, `full`) must play exactly as it did before the
 * enumeration moved into `legalActions.ts`. This file names twenty fights, both sides on `full`,
 * and `hashOfFight` reduces each one to a short string, so a refactor that changes ANY choice
 * anywhere in a fight changes that fight's hash. The expected hashes live in
 * `aiDeterminism.test.ts` and were computed on the parent commit BEFORE the module was extracted.
 *
 * The mix, which is what the gate runs (`determinismFights`):
 *  - 10 × 1v1, one EA starter deck against another (both orientations, ten seeds);
 *  - 10 × 2v2, two EA starters against the first two members of a gym's authored boss team.
 *    Two bodies is the smallest fight with more than one caster, which is the part of the
 *    enumeration 1v1 cannot reach, and it costs seconds where a full 3v3 costs up to a minute.
 *
 * `determinismFights3v3` is the same idea at the real size (a team of three EA starters against a
 * whole boss team) and is NOT in the gate: ten of them take about eight minutes. It was run by
 * hand on the parent and after the refactor, and the hashes it printed are in the 177a commit.
 *
 * Bosses come without their side-level Driver: the Driver is a modifier on the battle, not on the
 * AI's choices, and the fight builder that wires it needs a whole run around it.
 *
 * Test support only (it imports from `src/debug`), never imported by the engine.
 */

import { LAUNCH_SPECIES, MingmingRegistry } from '../data/mingmingRegistry';
import { authoredBossFor } from '../run/bosses';
import { matchupScenario, teamScenario } from '../../debug/balance/balanceScenarios';
import { runOne } from '../../debug/balance/runBatch';
import type { ComposedSetup } from '../../debug/scenarios/scenarioSchema';

export interface DeterminismFight {
    readonly name: string;
    readonly setup: ComposedSetup;
    readonly seed: string;
    readonly startingSide: 'PLAYER' | 'ENEMY';
}

const starters: ReadonlyArray<readonly [string, string]> = LAUNCH_SPECIES.flatMap(
    (species) => (MingmingRegistry[species]?.availableOS ?? []).map((os) => [species, os] as const),
);

const GYMS = ['gym_emberfall', 'gym_tidewrack', 'gym_rootfall'] as const;

function bossFor(gymId: string) {
    const boss = authoredBossFor(gymId);
    if (!boss) throw new Error(`[aiDeterminismFights] ${gymId} has no authored boss.`);
    return boss;
}

/** Three distinct launch species, a different trio each time; the OS alternates between a species' two. */
function trio(i: number): Array<readonly [string, string]> {
    return [0, 1, 2].map((k) => {
        const species = LAUNCH_SPECIES[(i + k * 2) % LAUNCH_SPECIES.length];
        const options = MingmingRegistry[species].availableOS;
        return [species, options[i % 2 === 0 ? 0 : 1] ?? options[0]] as const;
    });
}

export function determinismFights(): DeterminismFight[] {
    const fights: DeterminismFight[] = [];

    for (let i = 0; i < 10; i += 1) {
        const [player, playerOS] = starters[i % starters.length];
        const [enemy, enemyOS] = starters[(i * 5 + 3) % starters.length];
        fights.push({
            name: `1v1 ${playerOS} v ${enemyOS}`,
            setup: matchupScenario({ player, playerOS, enemy, enemyOS }),
            seed: `det177:1v1:${i}`,
            startingSide: i % 2 === 0 ? 'PLAYER' : 'ENEMY',
        });
    }

    for (let i = 0; i < 10; i += 1) {
        const gymId = GYMS[i % GYMS.length];
        const boss = bossFor(gymId);
        const team = trio(i).slice(0, 2);
        fights.push({
            name: `2v2 ${team.map(([, os]) => os).join('+')} v ${gymId} boss`,
            setup: teamScenario({
                player: team,
                enemy: boss.members.slice(0, 2).map((m) => [m.species, m.os] as const),
                seed: `det177:2v2:${i}`,
            }),
            seed: `det177:2v2:${i}`,
            startingSide: i % 3 === 0 ? 'ENEMY' : 'PLAYER',
        });
    }
    return fights;
}

/** The out-of-gate set: a team of three against a whole authored boss team. */
export function determinismFights3v3(): DeterminismFight[] {
    const fights: DeterminismFight[] = [];
    for (let i = 0; i < 10; i += 1) {
        const gymId = GYMS[i % GYMS.length];
        const boss = bossFor(gymId);
        const team = trio(i);
        fights.push({
            name: `3v3 ${team.map(([, os]) => os).join('+')} v ${gymId} boss`,
            setup: teamScenario({
                player: team,
                enemy: boss.members.map((m) => [m.species, m.os] as const),
                seed: `det177:3v3:${i}`,
            }),
            seed: `det177:3v3:${i}`,
            startingSide: i % 3 === 0 ? 'ENEMY' : 'PLAYER',
        });
    }
    return fights;
}

/** FNV-1a over the JSON of the result. Short, stable, and sensitive to every field. */
export function fnv1a(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/** Play one fight, both sides on the process-default tier (`full`), and hash what came out. */
export function hashOfFight(fight: DeterminismFight): string {
    const result = runOne(fight.setup, fight.seed, undefined, fight.startingSide, true);
    return fnv1a(JSON.stringify(result));
}
