/**
 * Ticket 77: is hel_v1's problem the AI, not the OS?
 *
 * Henry's read, and it is a better one than ticket 75's: the deck is MEANT to play its damage
 * dealers in a group and then END the turn on a Light card, so the -30% defensive stance is up
 * while the opponent swings. The end-of-action rule enables exactly that. Ticket 75 measured
 * "66.3% of damage taken in Dark stance" and concluded the OS was structurally inverted - but
 * that number is equally consistent with the OS being fine and the AI never closing on Light.
 *
 * This separates the two. It records how her turns actually END, whether a Light card was
 * available when they ended, and what one turn of correct play would have been worth. It also
 * carries the knobs Henry asked for: stance percentages, `purify`'s slot, and `eclipse`'s cost.
 *
 * ARM format (env ARMS, `;`-separated): name|dark|light|deck|eclipseCost|eclipsePower|policy
 *   dark/light   - stance percentages, blank = live (0.30 / 0.30)
 *   deck         - blank = live; `nopurify` swaps purify for nights_bite
 *   policy       - blank = the real AI; `closelight` = force a Light card as the turn's last play
 */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter, deriveSeeds } from '../src/debug/balance/runBatch';
import { GetProgramData, ProgramRegistry } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { STANCE_BONUS } from '../src/engine/core/Hooks';
import type { IBattleState, IBattleEntity } from '../src/engine/types';

const ITER = Number(process.env.ITER ?? 12);
const BASE_DECK: string[] = [...(MingmingRegistry as never as Record<string, { decks: Record<string, string[]> }>).hel.decks.hel_v1];

const stanceOf = (e: IBattleEntity): 'Dark' | 'Light' | 'none' =>
    e.statusEffects?.some(s => s.type === 'DarkStance') ? 'Dark'
        : e.statusEffects?.some(s => s.type === 'LightStance') ? 'Light' : 'none';
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);
const elementOf = (dataId: string): string => GetProgramData(dataId)?.element ?? 'None';

/** A Light card she can afford right now - what "close on Light" needs to exist. */
function playableLight(st: IBattleState): { id: string; dataId: string } | undefined {
    const energy = st.playerParty[0].currentEnergy;
    return st.playerDeck.hand.find(c => {
        const d = GetProgramData(c.dataId);
        return d?.element === 'Light' && (d.baseCost ?? 99) <= energy;
    });
}

interface Arm {
    label: string; dark?: number; light?: number; deck?: string;
    eclipseCost?: number; eclipsePower?: number; policy?: string;
}

function run(a: Arm) {
    // --- knobs ---
    if (a.deck === 'nopurify')
        (MingmingRegistry as never as Record<string, { decks: Record<string, string[]> }>).hel.decks.hel_v1 =
            BASE_DECK.map(c => (c === 'purify' ? 'nights_bite' : c));
    else (MingmingRegistry as never as Record<string, { decks: Record<string, string[]> }>).hel.decks.hel_v1 = [...BASE_DECK];
    const ecl = (ProgramRegistry as never as Record<string, { baseCost: number; actions: Array<{ power: number }> }>).eclipse;
    ecl.baseCost = a.eclipseCost ?? 2;
    ecl.actions[0].power = a.eclipsePower ?? 40;
    STANCE_BONUS.dark = a.dark ?? 0.30;
    STANCE_BONUS.light = a.light ?? 0.30;

    let turnsHers = 0, endedLight = 0, endedDark = 0, endedNone = 0;
    let couldHaveClosedLight = 0, closedWhenCould = 0;
    let takenInLight = 0, takenTotal = 0, dealtTotal = 0;
    let wins = 0, games = 0;
    // purify's premise: does she do better against decks that actually apply Poison/Burn?
    const split = { dot: { w: 0, g: 0 }, nodot: { w: 0, g: 0 } };
    const perCard: Record<string, { plays: number; dmg: number; cost: number }> = {};

    for (const opp of BALANCE_SPECIES.filter(s => s !== 'hel')) {
        const oppReg = (MingmingRegistry as never as Record<string, { decks: Record<string, string[]>; availableOS: string[] }>)[opp];
        const oppDeck = oppReg.decks[oppReg.availableOS[0]];
        const isDot = oppDeck.some(id => (GetProgramData(id)?.actions ?? []).some(x => {
            const stx = (x as unknown as { status?: string }).status; return stx === 'Poison' || stx === 'Burn';
        }));
        const bucket = isDot ? split.dot : split.nodot;
        const setup = matchupScenario({ player: 'hel', enemy: opp, playerOS: 'hel_v1', seed: `band:hel_v1:${opp}` });
        for (const seed of deriveSeeds(setup.seed, ITER)) for (const side of ['PLAYER', 'ENEMY'] as const) {
            const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
            let st: IBattleState = side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
            let g = 0; games++; bucket.g++;
            const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
            while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && g++ < 4000) {
                const wasMine = st.activeSide === 'PLAYER';
                const myHpBefore = hp(st.playerParty), foeHpBefore = hp(st.enemyParty);
                const stanceBefore = stanceOf(st.playerParty[0]);

                let act: BattleAction = getBestAction(st);

                // POLICY `closelight`: if the AI is about to end her turn and a Light card is
                // castable, cast it first.
                if (wasMine && a.policy === 'closelight' && act.type === 'END_TURN') {
                    const light = playableLight(st);
                    if (light && stanceBefore !== 'Light')
                        act = { type: 'PLAY_PROGRAM', payload: { sourceId: st.playerParty[0].id, targetId: st.enemyParty[0].id, programId: light.id } } as BattleAction;
                }

                // POLICY `reserve`: the FULL line Henry describes - group the damage, then close
                // on Light. `closelight` alone only helps when a Light card happens to survive to
                // the end of the turn; this also stops her spending her last one early. If the AI
                // wants to play her only castable Light card while a non-Light play is still
                // available, take the non-Light play instead and keep the Light one for the close.
                if (wasMine && a.policy === 'reserve' && act.type === 'PLAY_PROGRAM') {
                    const chosen = st.playerDeck.hand.find(c => c.id === (act as never as { payload: { programId: string } }).payload.programId);
                    const chosenIsLight = chosen && GetProgramData(chosen.dataId)?.element === 'Light';
                    const lights = st.playerDeck.hand.filter(c => GetProgramData(c.dataId)?.element === 'Light');
                    const energy = st.playerParty[0].currentEnergy;
                    const otherPlayable = st.playerDeck.hand.find(c =>
                        c.id !== chosen?.id && GetProgramData(c.dataId)?.element !== 'Light'
                        && (GetProgramData(c.dataId)?.baseCost ?? 99) <= energy);
                    if (chosenIsLight && lights.length === 1 && otherPlayable)
                        act = { type: 'PLAY_PROGRAM', payload: { sourceId: st.playerParty[0].id, targetId: st.enemyParty[0].id, programId: otherPlayable.id } } as BattleAction;
                }
                if (wasMine && a.policy === 'reserve' && act.type === 'END_TURN') {
                    const light = playableLight(st);
                    if (light && stanceBefore !== 'Light')
                        act = { type: 'PLAY_PROGRAM', payload: { sourceId: st.playerParty[0].id, targetId: st.enemyParty[0].id, programId: light.id } } as BattleAction;
                }

                let cast: string | undefined;
                if (wasMine && act.type === 'PLAY_PROGRAM')
                    cast = st.playerDeck.hand.find(c => c.id === (act as never as { payload: { programId: string } }).payload.programId)?.dataId;

                // Turn is ending for her: record what she closes on and whether she had a choice.
                if (wasMine && (act.type === 'END_TURN' || !playableAnything(st))) {
                    turnsHers++;
                    const s = stanceBefore;
                    if (s === 'Light') endedLight++; else if (s === 'Dark') endedDark++; else endedNone++;
                    if (s !== 'Light' && playableLight(st)) couldHaveClosedLight++;
                    else if (s === 'Light') closedWhenCould++;
                }

                let next = battleReducer(st, act);
                if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }

                const dealt = Math.max(0, foeHpBefore - hp(next.enemyParty));
                const taken = Math.max(0, myHpBefore - hp(next.playerParty));
                if (dealt) dealtTotal += dealt;
                if (taken) { takenTotal += taken; if (stanceOf(st.playerParty[0]) === 'Light') takenInLight += taken; }
                if (cast) {
                    const rec = (perCard[cast] ??= { plays: 0, dmg: 0, cost: GetProgramData(cast)?.baseCost ?? 0 });
                    rec.plays++; rec.dmg += dealt;
                }
                st = next;
            }
            if (!alive(st.enemyParty) && alive(st.playerParty)) { wins++; bucket.w++; }
        }
    }

    const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : 'n/a';
    console.error(`\nARM ${a.label}`);
    console.error(`  field win ${pct(wins, games)}   turns hers ${turnsHers}`);
    console.error(`  vs DoT decks ${pct(split.dot.w, split.dot.g)} (${split.dot.g} games)   vs non-DoT ${pct(split.nodot.w, split.nodot.g)} (${split.nodot.g} games)   <- purify's premise`);
    console.error(`  she ENDS her turn in:  Light ${pct(endedLight, turnsHers)}   Dark ${pct(endedDark, turnsHers)}   neither ${pct(endedNone, turnsHers)}`);
    console.error(`  ended NOT in Light while holding a castable Light card: ${couldHaveClosedLight} (${pct(couldHaveClosedLight, turnsHers)} of her turns)`);
    console.error(`  damage taken while in Light stance: ${pct(takenInLight, takenTotal)}   (total taken ${takenTotal}, dealt ${dealtTotal})`);
    console.error(`  ${'card'.padEnd(14)}${'cost'.padStart(5)}${'plays'.padStart(7)}${'damage'.padStart(8)}${'dmg/cast'.padStart(10)}${'dmg/energy'.padStart(12)}`);
    for (const [id, r] of Object.entries(perCard).sort((x, y) => y[1].dmg - x[1].dmg))
        console.error(`  ${id.padEnd(14)}${String(r.cost).padStart(5)}${String(r.plays).padStart(7)}${String(r.dmg).padStart(8)}${(r.dmg / r.plays).toFixed(1).padStart(10)}${(r.dmg / r.plays / Math.max(1, r.cost)).toFixed(1).padStart(12)}`);
}

function playableAnything(st: IBattleState): boolean {
    const e = st.playerParty[0].currentEnergy;
    return st.playerDeck.hand.some(c => (GetProgramData(c.dataId)?.baseCost ?? 99) <= e);
}
void elementOf;

for (const spec of (process.env.ARMS ?? 'live|||||').split(';').filter(Boolean)) {
    const [label, dark, light, deck, ec, ep, policy] = spec.split('|');
    run({
        label, dark: dark ? Number(dark) : undefined, light: light ? Number(light) : undefined,
        deck: deck || undefined, eclipseCost: ec ? Number(ec) : undefined,
        eclipsePower: ep ? Number(ep) : undefined, policy: policy || undefined,
    });
}
