/**
 * Ticket 101's two measurements, in one pass.
 *
 * 1. THE DRINK PILE. The ticket: *"seed ASSUMED_CONSUMED_STACKS[Regen] from the measured drink pile
 *    (expect ~6)"*. The pricer currently has no Regen entry, so it falls back to one stack and reads
 *    `drink_deep` at 1.3 against a 5.2-6.5 band - a card it cannot see. This measures what the drink
 *    actually eats in real games.
 *
 * 2. DRINK-DEPENDENCE. The ticket's stated ship criterion is *"the one that lands the band with the
 *    LEAST drink-dependence"* - a deck that only wins when it draws its payoff has one turn in it.
 *    This measures what share of her damage `drink_deep` accounts for, which is the honest way to
 *    choose between raising the BATTERY (the OS grant) and raising the PAYOFF (the drink's power).
 *
 * env: ARM (default A3), ITER, OS_REGEN / DEW / DRINK (the ruled knobs)
 */
import PROGRAMS from '../src/engine/data/programs.json';
import HOOKS from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

const P = PROGRAMS as unknown as Record<string, { actions: Array<Record<string, unknown>> }>;
const H = HOOKS as unknown as Record<string, { hooks: Array<{ do: Array<Record<string, unknown>> }> }>;
if (ENV.OS_REGEN) H.audhumbla_v2.hooks[0].do[0].stacks = Number(ENV.OS_REGEN);
if (ENV.DEW) (P.morning_dew.actions[0] as { stacks: number }).stacks = Number(ENV.DEW);
if (ENV.DRINK) (P.drink_deep.actions[1] as { power: number }).power = Number(ENV.DRINK);

const HEALS = ['pale_mercy', 'pale_mercy', 'healing_light', 'sacred_spring'];
const ARMS: Record<string, string[]> = {
    A2: [...HEALS, 'morning_dew', 'morning_dew', 'drink_deep', 'smite', 'radiant_spark'],
    A3: [...HEALS, 'morning_dew', 'drink_deep', 'smite', 'radiant_spark', 'dawnstrike'],
    A4: ['pale_mercy', 'healing_light', 'sacred_spring', 'morning_dew', 'drink_deep',
        'smite', 'radiant_spark', 'dawnstrike', 'dawnstrike'],
    A3x2: [...HEALS, 'morning_dew', 'drink_deep', 'drink_deep', 'smite', 'dawnstrike'],
};
const ARM = ENV.ARM ?? 'A3';

const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
(MingmingRegistry.audhumbla.decks as Record<string, string[]>).audhumbla_v2 = ARMS[ARM];

const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { deriveSeeds, applyStatJitter } = await import('../src/debug/balance/runBatch');
const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
type St = import('../src/engine/types').IBattleState;

const ITER = Number(ENV.ITER ?? 4);
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'audhumbla')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
const sample = opponents.filter((_, i) => i % 2 === 0);

const piles: number[] = [];
let drinkDamage = 0;
let otherDamage = 0;
let games = 0;
let gamesWithDrink = 0;

for (const o of sample) {
    const setup = matchupScenario({
        player: 'audhumbla', enemy: o.sp, playerOS: 'audhumbla_v2', enemyOS: o.deck,
        seed: `drink:${o.deck}`,
    });
    for (const seed of deriveSeeds(setup.seed, ITER)) {
        let st = buildScenarioState({ ...applyStatJitter(setup, seed), seed }) as St;
        games++;
        let drankHere = false;
        let guard = 0;
        const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            const mineNow = st.activeSide === 'PLAYER';
            const action = getBestAction(st);
            // Identify the card BEFORE it resolves, and read the Regen pile at that instant.
            let played: string | undefined;
            let pileNow = 0;
            if (mineNow && action.type === 'PLAY_PROGRAM') {
                const card = st.playerDeck.hand.find(c => c.id === action.payload.programId);
                played = card?.dataId;
                pileNow = st.playerParty[0]?.statusEffects.find(s => s.type === 'Regen')?.stacks ?? 0;
            }
            const enemyBefore = st.enemyParty.reduce((a, e) => a + e.currentHp, 0);
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            if (played) {
                const dealt = enemyBefore - next.enemyParty.reduce((a, e) => a + e.currentHp, 0);
                if (dealt > 0) {
                    if (played === 'drink_deep') {
                        drinkDamage += dealt; piles.push(pileNow); drankHere = true;
                    } else otherDamage += dealt;
                }
            }
            st = next;
        }
        if (drankHere) gamesWithDrink++;
    }
}

piles.sort((a, b) => a - b);
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const total = drinkDamage + otherDamage;
console.error(`\nDRINK CENSUS  arm ${ARM}  ${games} games  ` +
    `OS ${H.audhumbla_v2.hooks[0].do[0].stacks}/heal  dew ${(P.morning_dew.actions[0] as { stacks: number }).stacks}  ` +
    `drink ${(P.drink_deep.actions[1] as { power: number }).power}/stack`);
console.error(`  drinks cast              ${piles.length}   in ${gamesWithDrink} of ${games} games ` +
    `(${((gamesWithDrink / games) * 100).toFixed(0)}%)`);
console.error(`  REGEN PILE when drunk    mean ${mean(piles).toFixed(2)}   median ${piles.length ? piles[Math.floor(piles.length / 2)] : 0}` +
    `   p90 ${piles.length ? piles[Math.floor(piles.length * 0.9)] : 0}   max ${piles.length ? piles[piles.length - 1] : 0}`);
console.error(`  DRINK-DEPENDENCE         ${total ? ((drinkDamage / total) * 100).toFixed(1) : '0.0'}% of her damage` +
    `   (drink ${drinkDamage} / other ${otherDamage})`);
console.error(`CSV,${ARM},${H.audhumbla_v2.hooks[0].do[0].stacks},${(P.morning_dew.actions[0] as { stacks: number }).stacks},` +
    `${(P.drink_deep.actions[1] as { power: number }).power},${mean(piles).toFixed(2)},` +
    `${total ? ((drinkDamage / total) * 100).toFixed(2) : 0}`);
