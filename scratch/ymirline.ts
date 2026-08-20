/**
 * Ticket 106: does "build early, slam late" ever beat "slam every turn" for ymir_v2?
 *
 * Henry, playtest round 3: *"Sometimes I want to build statuses, but the 2e cards do too much dmg
 * compared to the 1e so it feels like I can't make the fun choice to try and add some str and dazed
 * to get the most out of my attacks. That's how he should play. Early build str + weaken enemy and
 * then slam in the last few turns. This time it didn't feel as fun."*
 *
 * GLACIAL_PACE_OS lets him play ONE card a turn, so a status turn is not a cheap rider on a real
 * turn - it IS the turn. That makes the question pure arithmetic: over N turns, does the extra
 * damage the pile adds to the later cards repay the nuke you skipped to build it?
 *
 * A field win rate cannot answer that. This plays SCRIPTED LINES against a target with enough HP to
 * survive the whole comparison, and reports cumulative damage per turn - which is the EV table the
 * ticket asks for.
 *
 * env: TURNS (default 6), STACKS_BRACING / STACKS_GALE / STACKS_SPEAR / STACKS_THAW (override the
 * printed status counts, which is the ticket's sanctioned lever)
 */
import PROGRAMS from '../src/engine/data/programs.json';

const P = PROGRAMS as unknown as Record<string, { actions: Array<Record<string, unknown>> }>;

/** The sanctioned lever: RAISE PRINTED STATUS COUNTS. Applied before anything else imports. */
function bump(card: string, status: string, to: number) {
    for (const a of P[card].actions) if (a.type === 'STATUS' && a.status === status) a.stacks = to;
}
if (process.env.STACKS_BRACING) bump('bracing_cold', 'Strengthened', Number(process.env.STACKS_BRACING));
if (process.env.STACKS_GALE) bump('numbing_gale', 'Dazed', Number(process.env.STACKS_GALE));
if (process.env.STACKS_SPEAR) bump('ice_spear', 'Weakened', Number(process.env.STACKS_SPEAR));
/**
 * The second lever, and the one the measurement points at. Raising the STACK counts makes the
 * payoff bigger but leaves the CROSSOVER turn where it was, because the crossover is set by the
 * hole the build turn digs (5 damage instead of 21), not by the size of the eventual payoff.
 * Raising the build card's own power fills the hole. Neither GLACIAL_PACE nor a 2e nuke is touched.
 */
if (process.env.POWER_BRACING) {
    (P.bracing_cold.actions.find(a => a.type === 'ATTACK') as { power: number }).power =
        Number(process.env.POWER_BRACING);
}
if (process.env.POWER_GALE) {
    (P.numbing_gale.actions.find(a => a.type === 'ATTACK') as { power: number }).power =
        Number(process.env.POWER_GALE);
}
if (process.env.POWER_THAW) {
    (P.thaw.actions.find(a => a.type === 'ATTACK') as { power: number }).power =
        Number(process.env.POWER_THAW);
}
if (process.env.STACKS_THAW) {
    bump('thaw', 'Strengthened', Number(process.env.STACKS_THAW));
    bump('thaw', 'Sharp', Number(process.env.STACKS_THAW));
}

const { battleReducer } = await import('../src/engine/battleReducer');
const { matchupScenario } = await import('../src/debug/balance/balanceScenarios');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
type St = import('../src/engine/types').IBattleState;

const TURNS = Number(process.env.TURNS ?? 6);

/**
 * The lines. Each entry is the ONE card played on that turn; the list is padded with its last
 * entry, so `['glacial_maul']` means "maul every turn while copies last".
 *
 * `glacial_maul` x2 is all he has, so a pure nuke line runs out and falls back to `ice_spear` -
 * which is exactly what happens in his hands too, and pretending otherwise would flatter the
 * nuke line.
 */
const LINES: Record<string, string[]> = {
    'NUKE (maul, maul, then spears)': ['glacial_maul', 'glacial_maul', 'ice_spear', 'ice_spear', 'numbing_gale', 'numbing_gale'],
    'BUILD1 (1 build, then slam)': ['bracing_cold', 'glacial_maul', 'glacial_maul', 'ice_spear', 'ice_spear', 'numbing_gale'],
    'BUILD2 (2 builds, then slam)': ['bracing_cold', 'bracing_cold', 'glacial_maul', 'glacial_maul', 'ice_spear', 'ice_spear'],
    'DEBUFF2 (2 gales, then slam)': ['numbing_gale', 'numbing_gale', 'glacial_maul', 'glacial_maul', 'ice_spear', 'ice_spear'],
    'HENRY (build str + daze, then slam)': ['bracing_cold', 'numbing_gale', 'thaw', 'glacial_maul', 'glacial_maul', 'ice_spear'],
};

/** A target fat enough to survive every line, so the comparison runs the full N turns. */
const DUMMY_HP = 100000;

function runLine(cards: string[]): number[] {
    const setup = matchupScenario({
        player: 'ymir', enemy: 'control', playerOS: 'ymir_v2', enemyOS: 'control_v1', seed: 'ymir106',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as St;
    let st = {
        ...base,
        activeSide: 'PLAYER',
        enemyParty: base.enemyParty.map((e, i) =>
            i === 0 ? { ...e, maxHp: DUMMY_HP, currentHp: DUMMY_HP } : e),
    } as St;
    const me = st.playerParty[0].id;
    const them = st.enemyParty[0].id;

    const perTurn: number[] = [];
    for (let turn = 0; turn < TURNS; turn++) {
        const cardId = cards[Math.min(turn, cards.length - 1)];
        st = {
            ...st,
            activeSide: 'PLAYER',
            // Full Energy each turn and the chosen card in hand: this measures the LINE, not the
            // draw. `playsThisTurn` reset too, or GLACIAL_PACE's one-card limit blocks turn 2.
            playerParty: st.playerParty.map((e, i) =>
                i === 0 ? { ...e, currentEnergy: e.maxEnergy, playsThisTurn: 0 } : e),
            playerDeck: {
                ...st.playerDeck,
                hand: [{ id: `t${turn}`, dataId: cardId, currentCost: 0, isPlayable: true }],
            },
        } as St;

        const before = st.enemyParty.find(e => e.id === them)!.currentHp;
        const after = battleReducer(st, {
            type: 'PLAY_PROGRAM', payload: { sourceId: me, targetId: them, programId: `t${turn}` },
        });
        perTurn.push(before - after.enemyParty.find(e => e.id === them)!.currentHp);
        st = after;
    }
    return perTurn;
}

const rows = Object.entries(LINES).map(([name, cards]) => {
    const per = runLine(cards);
    const cum: number[] = [];
    per.reduce((a, b, i) => (cum[i] = a + b), 0);
    return { name, per, cum };
});

const nuke = rows[0];
console.error(`\nYMIR_V2 LINE EV   ${TURNS} turns, one card per turn (GLACIAL_PACE)`);
console.error(`  bracing_cold ${P.bracing_cold.actions.find(a => a.type === 'STATUS')!.stacks} Str  ` +
    `| numbing_gale ${P.numbing_gale.actions.find(a => a.type === 'STATUS')!.stacks} Dazed  ` +
    `| ice_spear ${P.ice_spear.actions.find(a => a.type === 'STATUS')!.stacks} Weakened  ` +
    `| thaw ${P.thaw.actions.find(a => a.type === 'STATUS')!.stacks} Str/Sharp`);
console.error(`  power: bracing_cold ${(P.bracing_cold.actions.find(a => a.type === 'ATTACK') as { power: number }).power}` +
    ` | numbing_gale ${(P.numbing_gale.actions.find(a => a.type === 'ATTACK') as { power: number }).power}` +
    ` | thaw ${(P.thaw.actions.find(a => a.type === 'ATTACK') as { power: number }).power}` +
    ` | glacial_maul ${(P.glacial_maul.actions.find(a => a.type === 'ATTACK') as { power: number }).power}\n`);
console.error('  line'.padEnd(38) + Array.from({ length: TURNS }, (_, i) => `T${i + 1}`.padStart(6)).join('') + '   vs NUKE   CROSSOVER');
for (const r of rows) {
    const gap = ((r.cum[TURNS - 1] - nuke.cum[TURNS - 1]) / nuke.cum[TURNS - 1]) * 100;
    // CROSSOVER is the number that matters, not the turn-6 total: games here run 5.57 turns, so a
    // line that only pays on turn 6 does not pay.
    const cross = r.cum.findIndex((v, i) => v >= nuke.cum[i]);
    console.error(`  ${r.name.padEnd(36)}` + r.cum.map(v => String(v).padStart(6)).join('') +
        (r === nuke ? '       —          —' : `   ${(gap >= 0 ? '+' : '') + gap.toFixed(1)}%      ` +
            (cross < 0 ? 'never' : `T${cross + 1}`)));
}
console.error('\n  cumulative damage. CROSSOVER = the first turn the line is level with the nuke line.');
console.error('  ymir_v2 games run 5.57 turns on the live grid, so anything crossing at T6 does not pay.');
for (const r of rows) console.error(`CSV,${r.name},${r.cum.join(',')}`);
