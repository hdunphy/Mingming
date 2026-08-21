/** Ticket 103: audhumbla_v1 collateral from the species attack buff (attack is per-SPECIES). */
const ATK = Number(process.env.ATK ?? 60);
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
(MingmingRegistry.audhumbla.baseStats as { attack: number }).attack = ATK;
const DECK = process.env.DECK ?? 'audhumbla_v1';
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'audhumbla')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
let sum = 0; const cells: number[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: 'audhumbla', enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `grid:${DECK}:${o.deck}`,
    }), { iterations: Number(process.env.ITER ?? 10) });
    sum += r.pooled.decisiveWinRate; cells.push(r.pooled.decisiveWinRate * 100);
}
console.error(`${DECK} atk ${ATK}   field ${((sum / opponents.length) * 100).toFixed(1)}%` +
    `   absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
