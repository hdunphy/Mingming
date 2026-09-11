/**
 * THE DRIVER CANARY — steam-release ticket 16's "OS/daemon compounding check".
 *
 * `economy-session.md` recorded the constraint when Drivers were ruled: *"Drivers add a THIRD
 * stacking layer over OS + daemon compounding - the canary suite (ticket 109 family) inherits the
 * check."* Ticket 16 says the same in its own words: *"every Driver goes through the OS/daemon
 * compounding canary before shipping."* This file is that check, and nothing else — it rules
 * nothing and touches no number.
 *
 * # THE QUESTION, AND THE SHAPE THAT ANSWERS IT
 *
 * "Does this Driver, on top of the OS and daemons a real party already runs, do something
 * degenerate?" Degenerate has three readings, and the report prints all three:
 *
 *  1. **Rate.** Procs per battle. A Driver that never fires is a VOID arm, not a null one (the
 *     merge report's costliest lesson), and a Driver that fires far more than its design imagined
 *     is the compounding this exists to find — STATIC FIELD under a zoo comp is the flagged case.
 *  2. **Outcome.** Win rate with the Driver against the same fights without it, PAIRED by seed and
 *     turn order, so the number reported is flips rather than two noisy rates side by side.
 *  3. **Degeneracy.** Any FTK, any stall, any comp the Driver carries past 90% — the same hard
 *     lines the ticket-109 canary drew.
 *
 * # THE POPULATION
 *
 * Each `REFERENCE_PANEL` comp holds the Driver and fights one other panel comp — the next one in
 * panel order, so the six matchups are six DIFFERENT pairings rather than six comps against one
 * opponent. That is deliberately the smallest population that still puts every panel OS and daemon
 * under the Driver at least once; the full round-robin is thirty pairs and is Henry's to run on his
 * machine (`--full`), because a cloud session cannot survive it (HANDOFF, ticket 70's procedural
 * finding). The bare arm is measured ONCE and shared by every Driver's comparison.
 *
 * The Element Drivers are a class, not eight designs: the `element` arm hands each comp the Driver
 * of its FIRST member's element — the mono-team payoff, measured as the payoff it is meant to be —
 * rather than running eight arms that differ only in which cards they touch.
 *
 * # WHAT IT CANNOT SAY
 *
 * n=12 per arm at the default is a rate census and a degeneracy screen, not a win-rate estimate.
 * The flips column is honest about that: read a 3:1 as "leaning", never as "significant".
 */

import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import {
    DRIVER_ANTIVENOM, DRIVER_BULWARK_REFLEX, DRIVER_DEEP_CACHE, DRIVER_FIRST_BLOOD,
    DRIVER_OVERKILL_RECOVERY, DRIVER_STATIC_FIELD, DRIVER_THIRD_STRIKE,
    describeDriver, elementDriverId,
} from '../../engine/data/driverRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import type { Element } from '../../engine/types';
import { quietly } from './balanceReporting';
import { teamScenario } from './balanceScenarios';
import { runBatch, type RunResult } from './runBatch';
import { REFERENCE_PANEL, type Comp } from './teamComps';

/** The arms, in report order. `element` resolves per comp — see the header. */
export const CANARY_ARMS: ReadonlyArray<string> = [
    DRIVER_FIRST_BLOOD, DRIVER_THIRD_STRIKE, DRIVER_STATIC_FIELD, DRIVER_ANTIVENOM,
    DRIVER_OVERKILL_RECOVERY, DRIVER_BULWARK_REFLEX, DRIVER_DEEP_CACHE, 'element',
];

/** A battle length cap above the 30-turn stall redline, for the same reason the snowball uses one. */
export const CANARY_MAX_TURNS = 40;

export interface CanaryOptions {
    /** Which arms to run; defaults to all of `CANARY_ARMS`. */
    arms?: ReadonlyArray<string>;
    /** Paired seeds per matchup. Each yields 2 battles (both turn orders). */
    iterations?: number;
    maxTurns?: number;
    /** Every ordered panel pair instead of the six-matchup ring. Thirty pairs; Henry's machine. */
    full?: boolean;
    /** Same-turn beam for the AI (screening: 8). Undefined = the process default. */
    aiBeam?: number;
    /** Injectable for a test: two cheap comps instead of the panel. */
    comps?: readonly Comp[];
    /** Progress, after every battle of every arm. */
    onBattle?: (arm: string, label: string, done: number, total: number) => void;
}

/** One battle, with the Driver's own activity counted alongside the outcome. */
export interface CanaryBattle {
    readonly arm: string;
    /** The Driver id actually fielded (the `element` arm resolves to one per comp). */
    readonly driverId: string | null;
    readonly matchup: string;
    readonly seed: string;
    readonly startingSide: 'PLAYER' | 'ENEMY';
    readonly winner: RunResult['winner'];
    readonly turns: number;
    readonly ftk: boolean;
    readonly truncated: boolean;
    /** `DRIVER_PROC` events from the PLAYER side during this battle. */
    readonly procs: number;
}

export interface ArmSummary {
    readonly arm: string;
    readonly battles: number;
    readonly wins: number;
    readonly winRate: number;
    /** Paired against the bare arm on (matchup, seed, order): battles the Driver turned into wins / losses. */
    readonly flipsToWin: number;
    readonly flipsToLoss: number;
    readonly procsPerBattle: number;
    /** Battles in which the Driver never fired. The VOID check — all of them means the arm is dead. */
    readonly silentBattles: number;
    readonly meanTurns: number;
    readonly ftk: number;
    readonly truncated: number;
    /** Comps the Driver carries to 100% of their (small) sample — a degeneracy flag, not a verdict. */
    readonly sweeps: ReadonlyArray<string>;
}

export interface CanaryReport {
    readonly bare: ArmSummary;
    readonly arms: ReadonlyArray<ArmSummary>;
    readonly battles: ReadonlyArray<CanaryBattle>;
}

/** The six-matchup ring: each comp holds the Driver against the next comp in panel order. */
export function ringOf(comps: readonly Comp[]): Array<[Comp, Comp]> {
    return comps.map((c, i) => [c, comps[(i + 1) % comps.length]] as [Comp, Comp]);
}

/** Every ordered pair of distinct comps. */
export function allPairsOf(comps: readonly Comp[]): Array<[Comp, Comp]> {
    const out: Array<[Comp, Comp]> = [];
    for (const a of comps) for (const b of comps) if (a.id !== b.id) out.push([a, b]);
    return out;
}

/** The Element Driver a comp "is": its first member's primary element. `None` has no Driver. */
export function elementArmFor(comp: Comp): string | null {
    const element = GetMingmingData(comp.members[0][0]).primaryElement as Element;
    return element === 'None' ? null : elementDriverId(element);
}

const resolveDriver = (arm: string, comp: Comp): string | null =>
    arm === 'bare' ? null : arm === 'element' ? elementArmFor(comp) : arm;

/**
 * Run one arm over the population. Exported so a test can run a two-comp population through it
 * and assert the counting; the report's arithmetic lives in `summarizeArm`.
 */
export function measureArm(arm: string, options: CanaryOptions = {}): CanaryBattle[] {
    const comps = options.comps ?? REFERENCE_PANEL;
    const pairs = options.full ? allPairsOf(comps) : ringOf(comps);
    const iterations = options.iterations ?? 1;
    const maxTurns = options.maxTurns ?? CANARY_MAX_TURNS;
    const total = pairs.length * iterations * 2;

    const out: CanaryBattle[] = [];
    let procs = 0;
    const unsubscribe = globalBattleEventBus.subscribe((e: BattleEvent) => {
        if (e.type === 'DRIVER_PROC' && e.fromPlayer) procs += 1;
    });
    try {
        for (const [player, enemy] of pairs) {
            const driverId = resolveDriver(arm, player);
            const matchup = `${player.id} vs ${enemy.id}`;
            const base = teamScenario({
                player: player.members, enemy: enemy.members,
                playerExtras: player.extras, enemyExtras: enemy.extras,
                // Seeded off the MATCHUP alone, never the arm, so bare and driven share seeds.
                seed: `driver-canary:${matchup}`,
            });
            const setup = { ...base, player: { ...base.player, drivers: driverId ? [driverId] : [] } };
            for (let i = 0; i < iterations; i++) {
                const seed = `${setup.seed}#${i}`;
                for (const startingSide of ['PLAYER', 'ENEMY'] as const) {
                    procs = 0;
                    const batch = quietly(() => runBatch(setup, {
                        seeds: [seed], maxTurns, startingSide,
                        ...(options.aiBeam === undefined ? {} : { aiBeam: options.aiBeam }),
                    }));
                    const run = batch.runs[0];
                    out.push({
                        arm, driverId, matchup, seed, startingSide,
                        winner: run.winner, turns: run.turns, ftk: run.ftk, truncated: run.truncated,
                        procs,
                    });
                    options.onBattle?.(arm, matchup, out.length, total);
                }
            }
        }
    } finally {
        unsubscribe();
    }
    return out;
}

const key = (b: CanaryBattle) => `${b.matchup}|${b.seed}|${b.startingSide}`;

/** Reduce one arm's battles against the bare arm's. Pure; a test hands it fabricated battles. */
export function summarizeArm(arm: string, battles: readonly CanaryBattle[], bare: readonly CanaryBattle[]): ArmSummary {
    const bareByKey = new Map(bare.map(b => [key(b), b]));
    let flipsToWin = 0, flipsToLoss = 0;
    for (const b of battles) {
        const twin = bareByKey.get(key(b));
        if (!twin || arm === 'bare') continue;
        if (b.winner === 'PLAYER' && twin.winner !== 'PLAYER') flipsToWin += 1;
        if (b.winner !== 'PLAYER' && twin.winner === 'PLAYER') flipsToLoss += 1;
    }
    const wins = battles.filter(b => b.winner === 'PLAYER').length;
    const byComp = new Map<string, CanaryBattle[]>();
    for (const b of battles) {
        const comp = b.matchup.split(' vs ')[0];
        byComp.set(comp, [...(byComp.get(comp) ?? []), b]);
    }
    const sweeps = [...byComp.entries()]
        .filter(([, bs]) => bs.length > 0 && bs.every(b => b.winner === 'PLAYER'))
        .map(([comp]) => comp);
    return {
        arm,
        battles: battles.length,
        wins,
        winRate: battles.length === 0 ? 0 : wins / battles.length,
        flipsToWin,
        flipsToLoss,
        procsPerBattle: battles.length === 0 ? 0 : battles.reduce((a, b) => a + b.procs, 0) / battles.length,
        silentBattles: arm === 'bare' ? 0 : battles.filter(b => b.procs === 0).length,
        meanTurns: battles.length === 0 ? 0 : battles.reduce((a, b) => a + b.turns, 0) / battles.length,
        ftk: battles.filter(b => b.ftk).length,
        truncated: battles.filter(b => b.truncated).length,
        sweeps,
    };
}

/** The whole canary: the bare arm once, then every requested Driver arm against it. */
export function measureDriverCanary(options: CanaryOptions = {}): CanaryReport {
    const arms = options.arms ?? CANARY_ARMS;
    const bareBattles = measureArm('bare', options);
    const battles: CanaryBattle[] = [...bareBattles];
    const summaries: ArmSummary[] = [];
    for (const arm of arms) {
        const armBattles = measureArm(arm, options);
        battles.push(...armBattles);
        summaries.push(summarizeArm(arm, armBattles, bareBattles));
    }
    return { bare: summarizeArm('bare', bareBattles, bareBattles), arms: summaries, battles };
}

/** The name to print for an arm. */
export function armName(arm: string): string {
    if (arm === 'bare') return 'bare (no Driver)';
    if (arm === 'element') return 'ELEMENT DRIVER (each comp its own)';
    return describeDriver(arm).name;
}
