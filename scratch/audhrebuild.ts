/**
 * Ticket 101: audhumbla_v2 = REGEN AS AMMO. The deck-composition arms.
 *
 * Henry ruled the numbers on 2026-08-20: the OS banks 2 Regen per heal card (PRIMORDIAL_MILK),
 * `morning_dew` is the battery (1e, 4 Regen), `drink_deep` is the payoff (2e, consume all Regen,
 * 15 power per stack - `sun_devourer`'s machinery pointed at Regen, and its price, for consistency).
 *
 * What he left open is the ARM: *"the attack COUNT is a composition arm ('it felt hard to deal
 * damage last time') - run arms at 2 / 3 / 4 damage dealers and ship the one that lands the band
 * with the LEAST drink-dependence."*
 *
 * Least drink-dependence is the real gate, not the win rate: a deck that only wins when it draws
 * `drink_deep` is a deck with one turn in it. So this reports the field rate AND how much of her
 * damage the drink actually accounts for.
 *
 * WHAT A REGEN STACK IS (ticket 34): stacks are TURNS, not intensity - flat 3% maxHP a turn, minus
 * one stack a turn. So the OS at 2/heal accumulates (decay is 1), which is what makes it a battery;
 * at 1/heal it would exactly cancel and never bank anything. That is the same knife-edge ticket 34
 * found on huldra_v1 (2/play won 79%, 1/play won 1%).
 *
 * env: ARM (A2|A3|A4|A3x2), ITER (default 10), OS_REGEN / DEW / DRINK (the ruled knobs)
 */
import PROGRAMS from '../src/engine/data/programs.json';
import HOOKS from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

const P = PROGRAMS as unknown as Record<string, { actions: Array<Record<string, unknown>> }>;
const H = HOOKS as unknown as Record<string, { hooks: Array<{ do: Array<Record<string, unknown>> }> }>;

// The three ruled knobs, max two rounds, one change per sim.
if (ENV.OS_REGEN) H.audhumbla_v2.hooks[0].do[0].stacks = Number(ENV.OS_REGEN);
if (ENV.DEW) (P.morning_dew.actions[0] as { stacks: number }).stacks = Number(ENV.DEW);
if (ENV.DRINK) (P.drink_deep.actions[1] as { power: number }).power = Number(ENV.DRINK);

/**
 * The arms. Nine cards each so the draw economy is identical and only the composition moves.
 * `purify` leaves the deck with the rebuild - ticket 103 had turned it into her shed, and this
 * supersedes that. `dawnstrike` counts as a damage dealer that happens to heal, which is exactly
 * why it is the swing card between arms.
 */
const HEALS = ['pale_mercy', 'pale_mercy', 'healing_light', 'sacred_spring'];
const ARMS: Record<string, string[]> = {
    A2: [...HEALS, 'morning_dew', 'morning_dew', 'drink_deep', 'smite', 'radiant_spark'],
    A3: [...HEALS, 'morning_dew', 'drink_deep', 'smite', 'radiant_spark', 'dawnstrike'],
    A4: ['pale_mercy', 'healing_light', 'sacred_spring', 'morning_dew', 'drink_deep',
        'smite', 'radiant_spark', 'dawnstrike', 'dawnstrike'],
    A3x2: [...HEALS, 'morning_dew', 'drink_deep', 'drink_deep', 'smite', 'dawnstrike'],
};

const ARM = ENV.ARM ?? 'A3';
const deck = ARMS[ARM];
if (!deck) throw new Error(`unknown ARM ${ARM}`);

const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
(MingmingRegistry.audhumbla.decks as Record<string, string[]>).audhumbla_v2 = deck;

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');

const ITER = Number(ENV.ITER ?? 10);
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'audhumbla')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

let sum = 0, dead = 0, turns = 0;
const cells: number[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: 'audhumbla', enemy: o.sp, playerOS: 'audhumbla_v2', enemyOS: o.deck,
        seed: `grid:audhumbla_v2:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; turns += r.pooled.averageTurns;
    cells.push(r.pooled.decisiveWinRate * 100);
}
const n = opponents.length;
console.error(`\naudhumbla_v2 ${ARM.padEnd(5)} field ${((sum / n) * 100).toFixed(1)}%   ` +
    `dead ${((dead / n) * 100).toFixed(1)}%   turns ${(turns / n).toFixed(2)}   ` +
    `absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
console.error(`  OS ${H.audhumbla_v2.hooks[0].do[0].stacks} Regen/heal  ` +
    `| dew ${(P.morning_dew.actions[0] as { stacks: number }).stacks}  ` +
    `| drink ${(P.drink_deep.actions[1] as { power: number }).power}/stack  | deck ${deck.join(' ')}`);
console.error(`CSV,${ARM},${((sum / n) * 100).toFixed(2)},${((dead / n) * 100).toFixed(2)},${(turns / n).toFixed(3)},${cells.filter(c => c >= 100 || c <= 0).length}`);
