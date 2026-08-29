/**
 * Does configuration actually reach the engine under vite-node?
 *
 * `vite.config.ts` sets `define: { 'process.env': {} }` so a stray env read cannot throw in the
 * browser bundle. The substitution is textual and fires on everything Vite transforms, which is why
 * the ticket-114 re-baseline silently measured `draugr_v2` eleven times: `gridshard.ts` read its
 * deck from `process.env` and got `undefined`.
 *
 * Two things need checking after that, and neither is obvious from reading the code:
 *   1. a plain `process.env` read here is dead (it should print {} / undefined), and
 *   2. `TacticalAI`'s `env`, which is deliberately written to dodge the define, is NOT.
 *
 * If line 2 disagrees with what you passed on the command line, every tier and beam setting in the
 * toolkit is a lie and no measurement taken with one can be trusted.
 *
 * Run:  AI_BEAM=8 AI_LITE=1 npx vite-node scratch/envprobe.ts
 * PowerShell:  $env:AI_BEAM=8; $env:AI_LITE=1; npx vite-node scratch/envprobe.ts
 */
import { AI_TIER } from '../src/engine/ai/TacticalAI';

const direct = (process.env ?? {}) as Record<string, string | undefined>;

console.log('--- what a PLAIN process.env read sees (expected: all undefined) ---');
console.log('  process.env.AI_LITE :', direct.AI_LITE);
console.log('  process.env.AI_BEAM :', direct.AI_BEAM);
console.log('  keys visible        :', Object.keys(direct).length);

console.log('\n--- what the ENGINE resolved (this is the one that matters) ---');
console.log('  AI_TIER             :', AI_TIER);

const wantLite = process.argv.includes('--expect-lite');
if (wantLite && AI_TIER !== 'lite') {
    console.error(`\nFAIL: asked for lite, engine resolved '${AI_TIER}'. The define is still winning.`);
    process.exit(1);
}
console.log('\nIf AI_TIER above reflects AI_LITE/AI_GREEDY, tier control is working.');
