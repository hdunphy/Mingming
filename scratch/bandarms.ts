/**
 * TICKET 134 - two systemic knobs for putting the roster back in band, measured.
 *
 * Henry: *"I feel like we need to nerf the zoo decks maybe change our powerscale... Give me some
 * knobs/options to try to get the decks back in band or do we need to a full redesign."*
 *
 * The grid says the shift is NOT about the zoo specifically: average card cost predicts a deck's
 * move at r = -0.568, and the three zoo panel members are simply among the cheapest decks. Nerfing
 * three decks does not fix an economy-wide shift, so both arms here are economy-wide.
 *
 *   ENERGY     +1 maxEnergy on every unit. The root cause is that +1 cardDraw arrived with NO extra
 *              energy, so a cheap deck converts the extra card into a play and an expensive one just
 *              holds it. This gives the expensive decks the means to cast what they now draw. It
 *              should lift the LOSERS rather than lower the winners.
 *   CHEAPNERF  -15% power on every 0e and 1e ATTACK. The other direction: if cheap cards are
 *              over-performing under the new economy, the cost curve is too flat at the bottom.
 *              This should lower the WINNERS.
 *
 * Run against the decks that moved furthest, both directions, so an arm that only helps one tail is
 * visible as such.
 *
 * Run: npx vite-node scratch/bandarms.ts -- --arm ENERGY --iter 30
 */
function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`bandarms: --${name} is required`);
        return dflt;
    }
    return v;
}
const ARM = arg('arm');
const ITER = Number(arg('iter', '30'));

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
((penv[E] ??= {} as never)).AI_BEAM = '0';

// Applied to the raw JSON before the registry loads - GetProgramData inflates a fresh object per
// call, so mutating anything afterwards is the ticket-103 dead-arm trap.
let touched = 0;
if (ARM === 'CHEAPNERF') {
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as unknown as
        Record<string, { baseCost: number | string; actions?: Array<{ type: string; power?: number }> }>;
    for (const card of Object.values(PROGRAMS)) {
        if (typeof card.baseCost !== 'number' || card.baseCost > 1 || !card.actions) continue;
        for (const a of card.actions) {
            if (a.type !== 'ATTACK' || typeof a.power !== 'number' || a.power <= 0) continue;
            a.power = Math.round(a.power * 0.85); touched++;
        }
    }
    if (touched === 0) throw new Error('bandarms: CHEAPNERF touched nothing');
}
/**
 * PCTNERF - the arm the mechanism actually points at.
 *
 * The +50% frame did not buff heals and DoT in absolute terms; it cost ATTACKS a third of their
 * reach, because damage does not read maxHp and heals / Burn / Poison / Regen all do. Measured
 * before: a 40-power attack went from 10.4% of a health bar to 6.9%, while a 30-power heal stayed
 * at 7.5%, so attack:heal went from 1.39 to 0.92.
 *
 * There are only two ways to restore that ratio. Multiplying attacks by 1.5 restores the OLD pace
 * and undoes the point of the HP buff. Dividing the percentage effects by 1.5 keeps the bigger
 * frames and the longer games and puts the relative economy back. This is that.
 */
if (ARM === 'PCTNERF') {
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as unknown as
        Record<string, { actions?: Array<{ type: string; power?: number }> }>;
    for (const card of Object.values(PROGRAMS)) {
        for (const a of card.actions ?? []) {
            if (a.type === 'HEAL' && typeof a.power === 'number' && a.power > 0) {
                a.power = Math.round(a.power / 1.5); touched++;
            }
        }
    }
    const { BURN_CONFIG } = await import('../src/engine/StatusBehaviors');
    for (const tier of (BURN_CONFIG as unknown as { tiers: Array<{ damagePercent: number }> }).tiers) {
        tier.damagePercent = tier.damagePercent / 1.5; touched++;
    }
    if (touched === 0) throw new Error('bandarms: PCTNERF touched nothing');
}
/**
 * ZEROCOST / BIGDISCOUNT - the arms the correlations, rather than my hypotheses, point at.
 *
 * ENERGY, CHEAPNERF and PCTNERF all failed to compress the spread, and between them they exhaust
 * the POWER levers. What they leave standing is the one thing the re-baseline grid actually
 * measured: average card cost predicts a deck's move at r = -0.568 and 0e share at r = +0.571.
 * Those are the two strongest signals on record and neither previous arm touched a cost.
 *
 * The mechanism that fits: +1 cardDraw and a 15-card hand removed CARDS as the binding constraint,
 * which promoted ENERGY to being the binding constraint. Under an energy constraint a cheap card is
 * strictly better than an expensive one of the same power-per-energy, because you get to cast more
 * of them per turn and the hand no longer runs out. That is why CHEAPNERF's -15% power did nothing
 * (it priced the cards down, not up) and why +1 ENERGY made the losers WORSE (the cheap decks had
 * cards in hand to spend it on and the expensive decks did not).
 *
 *   ZEROCOST      every 0-cost program becomes 1-cost. Attacks the top correlate head-on and also
 *                 serves Henry's feel note - a 0e card is the thing that leaves energy on the table.
 *   BIGDISCOUNT   -1 cost on every 3e+ program. The same fix from the other end: make the expensive
 *                 decks able to cast what the new draw hands them, without touching the winners.
 */
if (ARM === 'ZEROCOST') {
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as unknown as
        Record<string, { baseCost: number | string }>;
    for (const card of Object.values(PROGRAMS)) {
        if (card.baseCost === 0) { card.baseCost = 1; touched++; }
    }
    if (touched === 0) throw new Error('bandarms: ZEROCOST touched nothing');
}
if (ARM === 'BIGDISCOUNT') {
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as unknown as
        Record<string, { baseCost: number | string }>;
    for (const card of Object.values(PROGRAMS)) {
        if (typeof card.baseCost === 'number' && card.baseCost >= 3) { card.baseCost -= 1; touched++; }
    }
    if (touched === 0) throw new Error('bandarms: BIGDISCOUNT touched nothing');
}
if (ARM === 'ENERGY') {
    const REG = (await import('../src/engine/data/mingmingRegistry.ts')).MingmingRegistry as unknown as
        Record<string, { baseStats: { energy: number } }>;
    for (const def of Object.values(REG)) {
        if (def?.baseStats && typeof def.baseStats.energy === 'number') { def.baseStats.energy += 1; touched++; }
    }
    if (touched === 0) throw new Error('bandarms: ENERGY touched nothing');
}

async function main(): Promise<void> {
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
    const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
    console.log(`ARM ${ARM}  (${touched} things changed)  iter ${ITER}`);
    if (ARM === 'ENERGY') {
        const e = (MingmingRegistry as Record<string, { baseStats: { energy: number } }>)['kraken'].baseStats.energy;
        console.log(`  assert: kraken baseStats.energy is now ${e}`);
    }

    // The extremes of the re-baseline, both tails, so a one-sided knob shows as one-sided.
    const DECKS = [
        'ratatoskr_v1', 'huldra_v1', 'jormungandr_v1', 'nidhoggr_v1', 'sleipnir_v1',  // biggest gainers
        'ymir_v2', 'fafnir_v2', 'nidhoggr_v2', 'fafnir_v1', 'sleipnir_v2',            // biggest losers
    ];
    for (const deck of DECKS) {
        const sp = deck.replace(/_v[12]$/, '');
        const opps: Array<{ sp: string; deck: string }> = [];
        for (const o of BALANCE_SPECIES) if (o !== sp)
            for (const d of MingmingRegistry[o].availableOS) opps.push({ sp: o, deck: d });
        let tot = 0;
        for (const o of opps) {
            const r = runPairedBatch(matchupScenario({
                player: sp, enemy: o.sp, playerOS: deck, enemyOS: o.deck, seed: `grid:${deck}:${o.deck}`,
            }), { iterations: ITER });
            tot += r.pooled.decisiveWinRate * 100;
        }
        console.log(`FIELD,${ARM},${deck},${(tot / opps.length).toFixed(2)}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
