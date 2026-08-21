/**
 * Ticket 108: the screening tier's ONLY job is to rank arms in the same order as the tier it
 * replaces. Per-cell agreement is the wrong test - the control run proved full disagrees with FULL
 * across seed bases by MAD 6-13, so any tier landing inside that is indistinguishable from noise.
 *
 * The right test is the one Henry's recorded objection names: **greedy is biased against
 * decision-heavy cards.** A card whose value depends on holding it until a pile is big is worth
 * nothing to an AI that can't see past this turn. So this measures the MARGINAL VALUE OF A CARD -
 * deck field with the card at printed power, minus deck field with it zeroed - at each tier.
 *
 * If a tier reports a smaller marginal value than full for a consume-payoff card, that tier will
 * under-rank every arm that makes such a card better, and it is not safe as a screen. Two subjects:
 * a consume-payoff card (sequencing matters enormously) and a plain attack (sequencing barely
 * matters) - the plain attack is the control, because a tier that under-reads EVERYTHING is just
 * noisy, while a tier that under-reads only the payoff card is biased.
 *
 * env: DECK, CARD (program id), ITER (default 10), SEEDBASE, ZERO=1 to null the card
 */
import { ProgramRegistry } from '../src/engine/data/programRegistry';

const CARD = process.env.CARD ?? 'momentum_crash';

// ZERO nulls the card's payoff without removing it from the deck - the deck keeps its shape, its
// energy curve and its card count, so the delta is the card's CONTRIBUTION rather than the
// difference between two different decks.
// POWER is the same knob at arbitrary values - a real sweep arm. ZERO=1 is POWER=0 with a name.
const POWER = process.env.ZERO === '1' ? '0' : process.env.POWER;
if (POWER !== undefined) {
    const card = (ProgramRegistry as Record<string, { actions: Array<Record<string, unknown>> }>)[CARD];
    if (!card) throw new Error(`no such program: ${CARD}`);
    for (const a of card.actions) if (a.type === 'ATTACK') a.power = Number(POWER);
}

const { AI_TIER } = await import('../src/engine/ai/TacticalAI');
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

const DECK = process.env.DECK ?? 'sleipnir_v1';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(process.env.ITER ?? 10);
const SEEDBASE = process.env.SEEDBASE ?? 'grid';

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

const started = Date.now();
let sum = 0;
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
        seed: `${SEEDBASE}:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate;
}
const field = (sum / opponents.length) * 100;
const ms = Date.now() - started;

console.log(`BIAS,${AI_TIER},${DECK},${CARD},${POWER ?? 'printed'},` +
    `${SEEDBASE},${field.toFixed(2)},${ms}`);
console.error(`  ${AI_TIER.padEnd(6)} ${DECK} ${CARD} ` +
    `${(POWER === undefined ? 'printed' : `pow=${POWER}`).padEnd(7)} @${SEEDBASE}  ` +
    `field ${field.toFixed(2)}%  ${(ms / 1000).toFixed(1)}s`);
