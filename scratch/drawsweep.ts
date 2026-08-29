/** Ticket 71: the compensation is a FIXED POINT, not a ratio - the AI re-sequences when the payoff moves. */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import type { IBattleState, IBattleEntity } from '../src/engine/types';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter, deriveSeeds } from '../src/debug/balance/runBatch';
import { ENV } from './_env';

const decks: Array<[string, string]> = [];
for (const [sp, d] of Object.entries(MingmingRegistry) as any) {
    if (sp === 'control') continue;
    for (const os of d.availableOS) {
        const list: string[] = d.decks[os] ?? [];
        if (list.some(c => c === 'ink_stream' || c === 'starfall')) decks.push([sp, os]);
    }
}
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);
const SCALING = ENV.SCALING ?? 'CARDS_DRAWN_TRIGGERED';
const setPower = (id: string, power: number) => {
    (ProgramRegistry as any)[id].actions[0].power = power;
    (ProgramRegistry as any)[id].actions[0].scaling = SCALING;
};

function arm(inkPower: number, starPower: number) {
    setPower('ink_stream', inkPower); setPower('starfall', starPower);
    const stats: Record<string, { n: number; trig: number[]; dmg: number }> = {};
    const dead: Record<string, number> = {};
    for (const [sp, os] of decks) {
        for (const opp of BALANCE_SPECIES.filter(s => s !== sp)) {
            const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `dc:${os}:${opp}` });
            for (const seed of deriveSeeds(setup.seed, 4)) for (const side of ['PLAYER', 'ENEMY'] as const) {
                const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
                let st: IBattleState = side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
                let g = 0; const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
                while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && g++ < 4000) {
                    const a: BattleAction = getBestAction(st);
                    let id: string | undefined; let trig = 0, before = 0;
                    if (a.type === 'PLAY_PROGRAM' && st.playerParty.some(e => e.id === a.payload.sourceId)) {
                        const d = st.playerDeck.hand.find(c => c.id === a.payload.programId)?.dataId;
                        if (d === 'ink_stream' || d === 'starfall') { id = d; trig = SCALING === 'CARDS_DRAWN' ? st.cardsDrawnThisTurn : (st.nonNaturalCardsDrawnThisTurn ?? 0); before = hp(st.enemyParty); }
                    }
                    let next = battleReducer(st, a);
                    if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
                    if (id) { const key = `${os}/${id}`; const s = (stats[key] ??= { n: 0, trig: [], dmg: 0 }); s.n++; s.trig.push(trig); s.dmg += Math.max(0, before - hp(next.enemyParty)); dead[key] = (dead[key] ?? 0) + (trig === 0 ? 1 : 0); }
                    st = next;
                }
            }
        }
    }
    const m = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
    const out: string[] = [];
    for (const k of Object.keys(stats).sort()) {
        const s = stats[k];
        const zero = s.trig.filter(v => v === 0).length;
        out.push(`${k} pow=${k.endsWith('ink_stream') ? inkPower : starPower} casts=${s.n} trigMean=${m(s.trig).toFixed(2)} zero=${(zero / s.n * 100).toFixed(1)}% dmg/cast=${(s.dmg / s.n).toFixed(1)} total=${s.dmg}`);
    }
    for (const o of out) console.error('ARM ' + o);
}

const arms: Array<[number, number]> = (ENV.ARMS ?? '')
    .split(';').filter(Boolean).map(a => a.split(',').map(Number) as [number, number]);
for (const [i, s] of arms) arm(i, s);
