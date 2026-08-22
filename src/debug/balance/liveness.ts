/**
 * Firmware-liveness sweep — ticket 55 amendment 1 §C.
 *
 * Run: `npx tsx src/debug/balance/liveness.ts` (from the repo root - it reads hooks.json by
 * repo-relative path, so the cwd must be the repo root).
 *
 * Exists because a DEAD HOOK IS INDISTINGUISHABLE FROM A WEAK DECK on every other instrument in
 * the suite. jormungandr_v1 spent eight tickets on ticket 49's floor list as a "genuinely real"
 * problem deck; its OS had never fired, and the fix alone moved its control matchup 45.0% -> 96.7%
 * on the unchanged deck. Three occurrences of the same family (HANDOFF 0-TARGETLESS) justified
 * building the instrument rather than checking by hand a fourth time.
 *
 * Two independent passes, because neither alone is sufficient:
 *
 *   STATIC   Replicates HookFactory's own guards over every hook in hooks.json and reports actions
 *            that can NEVER apply: a non-LOG action with no `target` (resolveTarget returns null
 *            and executeActions early-continues), a key zod stripped between raw JSON and
 *            HookLibrarySchema (8c2), an empty `do`, or a modifier hook carrying neither `bonus`
 *            nor `multiplier`. Catches hooks whose trigger conditions are too rare to probe.
 *
 *   DYNAMIC  Wraps every registered hook function and runs probe battles per OS, recording
 *            invocations and OBSERVABLE EFFECTS - a returned state that differs from the input, or
 *            a modifier that actually changed the damage. Catches hooks that are well-formed but
 *            whose conditions never match in a real game.
 *
 * A hook can pass one and fail the other, which is the point. `huldra_v2_bark_start` is statically
 * perfect and dynamically silent (0 effects in 10,649 calls).
 */
/**
 * Ticket 55 amendment 1 §C — firmware liveness sweep.
 * Two independent passes over all 32 OSes:
 *   STATIC  — replicate HookFactory's own guards and find actions that can NEVER apply.
 *   DYNAMIC — wrap every registered hook fn, run probe battles, record invocations and
 *             observable effects.
 */
import fs from 'fs';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { HookLibrarySchema } from '../../engine/data/HookSchema';
import { matchupScenario, mirrorScenario, BALANCE_SPECIES, CONTROL_SPECIES } from './balanceScenarios';
import { runBatch } from './runBatch';
import { quietly } from './balanceReporting';

const RAW = JSON.parse(fs.readFileSync('src/engine/data/lib/hooks.json', 'utf8'));
const PARSED: any = HookLibrarySchema.parse(RAW);
const osIds = BALANCE_SPECIES.flatMap(s => MingmingRegistry[s].availableOS);

// ---------- STATIC ----------
type Finding = { os: string; hook: string; kind: string; detail: string };
const findings: Finding[] = [];
const MODIFIER_TRIGGERS = new Set(['onDamageCalculated','onStatusDamageCalculated','onCostCalculated','onHealCalculated']);

for (const os of osIds) {
  const raw = RAW[os]; const parsed = PARSED[os];
  if (!raw) { findings.push({ os, hook: '-', kind: 'NO_ENTRY', detail: 'no hooks.json entry' }); continue; }
  const rawHooks = raw.hooks ?? [];
  for (let i = 0; i < rawHooks.length; i++) {
    const h = rawHooks[i]; const ph = parsed?.hooks?.[i];
    // zod-stripped keys (8c2)
    const strip = (o: any, p: any, path: string) => {
      if (!o || !p || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (!(k in p)) findings.push({ os, hook: h.id, kind: 'ZOD_STRIPPED', detail: `${path}${k}` });
        else if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) strip(o[k], p[k], `${path}${k}.`);
      }
    };
    strip(h, ph, '');
    if (MODIFIER_TRIGGERS.has(h.trigger)) {
      if (h.bonus === undefined && h.multiplier === undefined)
        findings.push({ os, hook: h.id, kind: 'NO_OP_MODIFIER', detail: 'modifier hook with neither bonus nor multiplier' });
      continue;
    }
    const doList = h.do ?? [];
    if (doList.length === 0) findings.push({ os, hook: h.id, kind: 'EMPTY_DO', detail: 'no actions' });
    for (const a of doList) {
      // HookFactory.executeActions: resolveTarget(undefined) -> null -> non-LOG actions are skipped.
      if (a.type !== 'LOG' && a.target === undefined)
        findings.push({ os, hook: h.id, kind: 'DROPPED_NO_TARGET', detail: `${a.type}${a.key ? ' ' + a.key : ''}` });
    }
  }
}

// ---------- DYNAMIC ----------
const stats: Record<string, { os: string; trigger: string; calls: number; effects: number }> = {};
for (const os of osIds) {
  const beh = getOSBehavior(os);
  if (!beh) continue;
  for (const hook of beh.hooks as any[]) {
    for (const trig of Object.keys(hook)) {
      if (['id','priority','data'].includes(trig) || typeof hook[trig] !== 'function') continue;
      const key = `${os}::${hook.id}::${trig}`;
      stats[key] = { os, trigger: trig, calls: 0, effects: 0 };
      const orig = hook[trig].bind(hook);
      if (MODIFIER_TRIGGERS.has(trig)) {
        hook[trig] = (dmg: number, ctx: any, owner: any) => {
          stats[key].calls++; const out = orig(dmg, ctx, owner);
          if (out !== dmg) stats[key].effects++; return out;
        };
      } else {
        hook[trig] = (ctx: any, owner: any) => {
          stats[key].calls++; const out = orig(ctx, owner);
          if (out && out.state !== ctx.state) stats[key].effects++; return out;
        };
      }
    }
  }
}

for (const os of osIds) {
  const sp = Object.keys(MingmingRegistry).find(s => MingmingRegistry[s].availableOS.includes(os))!;
  quietly(() => runBatch({ ...mirrorScenario(sp), seed: `LV:m:${os}` }, { iterations: 6, maxTurns: 60 }));
  quietly(() => runBatch(matchupScenario({ player: sp, enemy: CONTROL_SPECIES, playerOS: os, seed: `LV:c:${os}` }), { iterations: 6, maxTurns: 60 }));
  for (const opp of BALANCE_SPECIES.filter(s => s !== CONTROL_SPECIES && s !== sp).slice(0, 5))
    quietly(() => runBatch(matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `LV:f:${os}:${opp}` }), { iterations: 3, maxTurns: 60 }));
}

console.log('### STATIC findings\n');
if (findings.length === 0) console.log('none\n');
for (const f of findings) console.log(`${f.kind.padEnd(20)} ${f.os.padEnd(18)} ${f.hook.padEnd(28)} ${f.detail}`);
console.log('\n### DYNAMIC liveness (calls / observable effects)\n');
const byOs: Record<string, { calls: number; effects: number; hooks: string[] }> = {};
for (const [k, v] of Object.entries(stats)) {
  const o = byOs[v.os] ?? (byOs[v.os] = { calls: 0, effects: 0, hooks: [] });
  o.calls += v.calls; o.effects += v.effects;
  if (v.effects === 0) o.hooks.push(`${k.split('::')[1]}:${v.trigger}(${v.calls} calls)`);
}
for (const os of osIds) {
  const o = byOs[os];
  if (!o) { console.log(`${os.padEnd(18)} NO REGISTERED HOOKS`); continue; }
  const verdict = o.effects > 0 ? 'LIVE' : (o.calls > 0 ? 'CALLED-BUT-NO-EFFECT' : 'NEVER CALLED');
  console.log(`${os.padEnd(18)} ${verdict.padEnd(22)} calls ${String(o.calls).padStart(6)}  effects ${String(o.effects).padStart(6)}${o.hooks.length ? '   silent: ' + o.hooks.join(', ') : ''}`);
}
