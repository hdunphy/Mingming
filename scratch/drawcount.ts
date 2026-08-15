/** Ticket 71: what do ink_stream and starfall actually see, natural-inclusive vs triggered-only? */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import type { IBattleState, IBattleEntity } from '../src/engine/types';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter, deriveSeeds } from '../src/debug/balance/runBatch';
const stats: Record<string, { n: number; nat: number[]; trig: number[]; dmg: number }> = {};
const decks: Array<[string,string]> = [];
for (const [sp, d] of Object.entries(MingmingRegistry) as any) {
    if (sp === 'control') continue;
    for (const os of d.availableOS) {
        const list: string[] = d.decks[os] ?? [];
        if (list.some(c => c === 'ink_stream' || c === 'starfall')) decks.push([sp, os]);
    }
}
console.error('decks carrying a CARDS_DRAWN scaler:', decks.map(d => d[1]).join(', '));
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t,e)=>t+e.currentHp,0);
for (const [sp, os] of decks) {
  for (const opp of BALANCE_SPECIES.filter(s => s !== sp)) {
    const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `dc:${os}:${opp}` });
    for (const seed of deriveSeeds(setup.seed, 4)) for (const side of ['PLAYER','ENEMY'] as const) {
      const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
      let st: IBattleState = side==='PLAYER'?built:{...built, activeSide:'ENEMY'};
      let g=0; const alive=(p:ReadonlyArray<IBattleEntity>)=>p.some(e=>e.currentHp>0);
      while (alive(st.playerParty)&&alive(st.enemyParty)&&st.turn<=60&&g++<4000) {
        const a: BattleAction = getBestAction(st);
        let id: string|undefined; let nat=0, trig=0, before=0;
        if (a.type==='PLAY_PROGRAM' && st.playerParty.some(e=>e.id===a.payload.sourceId)) {
          const d = st.playerDeck.hand.find(c=>c.id===a.payload.programId)?.dataId;
          if (d==='ink_stream'||d==='starfall') { id=d; nat=st.cardsDrawnThisTurn; trig=st.nonNaturalCardsDrawnThisTurn??0; before=hp(st.enemyParty); }
        }
        let next = battleReducer(st,a);
        if (next===st) { next=battleReducer(st,{type:'END_TURN'}); if (next===st) break; }
        if (id) { const s=(stats[id] ??= {n:0,nat:[],trig:[],dmg:0}); s.n++; s.nat.push(nat); s.trig.push(trig); s.dmg += Math.max(0, before-hp(next.enemyParty)); }
        st=next;
      }
    }
  }
}
const m=(x:number[])=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);
for (const [k,s] of Object.entries(stats)) {
  const zero = s.trig.filter(v=>v===0).length;
  console.error(`${k}: casts ${s.n}  natural-incl mean ${m(s.nat).toFixed(2)}  TRIGGERED mean ${m(s.trig).toFixed(2)}  zero-triggered ${zero} (${(zero/s.n*100).toFixed(1)}%)  dmg/cast ${(s.dmg/s.n).toFixed(1)}  ratio ${(m(s.nat)/Math.max(0.01,m(s.trig))).toFixed(2)}x`);
}
