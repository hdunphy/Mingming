/**
 * TICKET 130 - solve for the numbers Henry ruled, rather than proposing them.
 *
 *  1. whirlpool_v2: "remove the power and make it add dazed and card draw. Whatever makes it in
 *     bound." -> search Dazed stacks x draw count for a 1e score inside 2.4-3.0.
 *  2. feedback_loop_daemon: "should be 1e and make the damage based off of a turn 2 play so it's
 *     power is calculated to 3.2 using the same scoring you devised." -> solve for proc power.
 *
 * Run: npx vite-node scratch/whatpower.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const reg = ProgramRegistry as unknown as Record<string, ProgramData>;
const band1 = budgetBandFor(1);

function score(card: ProgramData): number { return calculatePowerscale(card).score; }

console.log(`\n1e band: ${band1.under} - ${band1.over}\n`);
console.log('WHIRLPOOL — no power, Dazed + draw. Shapes inside the band are marked.');
for (const dazed of [1, 2, 3]) {
    for (const draw of [1, 2]) {
        const card = {
            ...reg['whirlpool_v2'],
            actions: [
                { type: 'DRAW', amount: draw, target: 'SELF' },
                { type: 'STATUS', status: 'Dazed', stacks: dazed, target: 'TARGET' },
            ],
        } as unknown as ProgramData;
        const s = score(card);
        const inb = s >= band1.under && s <= band1.over;
        console.log(`  ${dazed} Dazed + draw ${draw}`.padEnd(30)
            + `${s.toFixed(1).padStart(5)}   ${inb ? '<-- IN BAND' : s < band1.under ? 'under' : 'over'}`);
    }
}
// Side scope, for completeness - it is what the card's neighbours in kraken_v1 now use.
for (const dazed of [1, 2]) {
    const card = {
        ...reg['whirlpool_v2'], target: 'Side',
        actions: [
            { type: 'DRAW', amount: 1, target: 'SELF' },
            { type: 'STATUS', status: 'Dazed', stacks: dazed, target: 'TARGET' },
        ],
    } as unknown as ProgramData;
    const s = score(card);
    console.log(`  ${dazed} Dazed to SIDE + draw 1`.padEnd(30)
        + `${s.toFixed(1).padStart(5)}   ${s >= band1.under && s <= band1.over ? '<-- IN BAND' : s < band1.under ? 'under' : 'over'}`);
}

/**
 * FEEDBACK LOOP. The scoring Henry means is the MEASURED one from ticket 129, not the shipped
 * scorer's flat `EXPECTED_DAEMON_PROCS = 4`:
 *
 *   score = procs x (power / 10) x 1.5        (1.5 = the daemon premium)
 *   procs = (measured triggered draws per turn) x (turns the daemon is live)
 *
 * Measured at 3v3: 0.75 per-unit triggered draws a turn (0.84 zoo / 0.65 control), five side-turns
 * a battle. A turn-2 play is live for turns 2..5 = 4 turns.
 */
const PER_UNIT_DRAWS = 0.75;
const SIDE_WIDE_DRAWS = 1.71;      // 1.84 zoo / 1.59 control
const TURNS = 5;
const PREMIUM = 1.5;
const solve = (target: number, rate: number, playedOn: number): number =>
    (target * 10) / (rate * (TURNS - playedOn + 1) * PREMIUM);
const at = (power: number, rate: number, playedOn: number): number =>
    rate * (TURNS - playedOn + 1) * (power / 10) * PREMIUM;

console.log('\nFEEDBACK_LOOP — solve for proc power so a TURN-2 play scores 3.2');
for (const [label, rate] of [['owner-gated (as shipped)', PER_UNIT_DRAWS], ['side-wide (source: ALLY)', SIDE_WIDE_DRAWS]] as const) {
    const p = solve(3.2, rate, 2);
    console.log(`  ${label}: ${rate.toFixed(2)} procs/turn -> power ${p.toFixed(2)}`);
    for (const pw of [Math.round(p), 5, 10]) {
        const row = [1, 2, 3, 4].map(t => `T${t} ${at(pw, rate, t).toFixed(1)}`).join('  ');
        console.log(`      at power ${String(pw).padStart(2)}:  ${row}`);
    }
}
console.log(`\n  (1e band ${band1.under}-${band1.over}. The shipped scorer would price the same card`);
console.log(`   at 4 flat procs, which is a different answer - see the daemon-pricing ticket.)`);
