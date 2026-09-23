/**
 * TICKET 152's GATES, COMPUTED — the shipped list against the two swap arms.
 *
 * §4 asks four questions of each arm and this answers the first three from the cast probe's own
 * jsonl. Written as one script over all three files rather than three runs of a one-file script,
 * because every gate here is a COMPARISON against the shipped baseline and a number without its
 * baseline beside it is not a gate.
 *
 * Run: npx vite-node scratch/t152_gates.ts -- results/t152/base.jsonl results/t152/armA.jsonl ...
 */
import fs from 'node:fs';

interface Cast {
    card: string;
    turn: number;
    /** 'self' or 'enemy' — which side the cast was aimed at. */
    target: string;
    pre: { nonNaturalDrawn: number; tgtMaxHp: number; selfMaxHp: number };
    post: { ledgerApplied?: number; ledgerRaw?: number; enemyHpDelta?: number; selfHpDelta?: number };
}
interface Game {
    opponent: string;
    winner: string;
    turns: number;
    ownerMaxHp: number;
    casts: Cast[];
}

function pct(list: number[], p: number): number {
    if (list.length === 0) return 0;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function analyse(path: string) {
    const games: Game[] = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

    let wins = 0, decisive = 0;
    const undertowPerTurn: number[] = [];
    const inkDraws: number[] = [];
    const dmgPerTurn: number[] = [];
    /** Ticket 152's brake arms: what the card costs its own caster, per turn. */
    const selfPerTurn: number[] = [];

    for (const g of games) {
        if (g.winner === 'PLAYER') { wins++; decisive++; }
        else if (g.winner === 'ENEMY') decisive++;

        // Per-turn buckets for this game.
        const byTurn = new Map<number, { undertow: number; dmg: number; self: number; pool: number; ownPool: number }>();
        for (const c of g.casts) {
            const slot = byTurn.get(c.turn) ?? { undertow: 0, dmg: 0, self: 0, pool: 0, ownPool: 0 };
            if (c.card === 'undertow') slot.undertow += 1;
            /*
             * `ledgerRaw` is the card's true output before shields and the zero floor, which is
             * what §2 measured. `enemyHpDelta` would undercount every shielded hit.
             *
             * SELF-FACING CASTS ARE EXCLUDED FROM `dmg`, and this is not a nicety. The first cut
             * summed every cast, so an arm that put RECOIL on `undertow` scored its own recoil as
             * damage dealt and read as a 177% turn against the shipped deck's 145% — i.e. the
             * brake made the card look more dangerous. Self-damage is a COST and gets its own
             * column.
             */
            if (c.target === 'self') slot.self += c.post.ledgerRaw ?? 0;
            else slot.dmg += c.post.ledgerRaw ?? 0;
            slot.pool = Math.max(slot.pool, c.pre.tgtMaxHp || 0);
            slot.ownPool = Math.max(slot.ownPool, c.pre.selfMaxHp || 0);
            if (c.card === 'ink_stream') inkDraws.push(c.pre.nonNaturalDrawn ?? 0);
            byTurn.set(c.turn, slot);
        }
        for (const slot of byTurn.values()) {
            undertowPerTurn.push(slot.undertow);
            if (slot.pool > 0) dmgPerTurn.push((slot.dmg / slot.pool) * 100);
            if (slot.ownPool > 0) selfPerTurn.push((slot.self / slot.ownPool) * 100);
        }
    }

    const loopTurns = undertowPerTurn.filter(n => n >= 6).length;
    const burstTurns = dmgPerTurn.filter(d => d >= 75).length;

    return {
        games: games.length,
        field: decisive > 0 ? (wins / decisive) * 100 : 0,
        turnsWithUndertow6: (loopTurns / Math.max(1, undertowPerTurn.length)) * 100,
        maxUndertowInATurn: Math.max(0, ...undertowPerTurn),
        inkMaxDraws: Math.max(0, ...inkDraws),
        inkMeanDraws: inkDraws.reduce((s, x) => s + x, 0) / Math.max(1, inkDraws.length),
        inkCasts: inkDraws.length,
        turnsOver75: (burstTurns / Math.max(1, dmgPerTurn.length)) * 100,
        dmgP50: pct(dmgPerTurn, 50),
        dmgP90: pct(dmgPerTurn, 90),
        dmgMax: Math.max(0, ...dmgPerTurn),
        selfP50: pct(selfPerTurn, 50),
        selfP90: pct(selfPerTurn, 90),
        selfMax: Math.max(0, ...selfPerTurn),
    };
}

const files = process.argv.slice(2).filter(a => a.endsWith('.jsonl'));
const rows = files.map(f => ({ name: f.split('/').pop()!.replace('.jsonl', ''), ...analyse(f) }));

const col = (label: string, get: (r: typeof rows[number]) => string) =>
    console.log(`${label.padEnd(30)} ${rows.map(r => get(r).padStart(12)).join('')}`);

console.log(`${''.padEnd(30)} ${rows.map(r => r.name.padStart(12)).join('')}\n`);
col('games', r => String(r.games));
col('field win %', r => r.field.toFixed(1));
console.log('\n-- gate 1: the loop is gone --');
col('turns with >=6 undertow %', r => r.turnsWithUndertow6.toFixed(1));
col('max undertow in one turn', r => String(r.maxUndertowInATurn));
col('ink_stream max triggered draws', r => String(r.inkMaxDraws));
col('ink_stream mean draws', r => r.inkMeanDraws.toFixed(2));
col('ink_stream casts', r => String(r.inkCasts));
console.log('\n-- gate 2: the burst is a burst --');
col('turns dealing >=75% of a pool %', r => r.turnsOver75.toFixed(1));
col('damage/turn p50 %', r => r.dmgP50.toFixed(1));
col('damage/turn p90 %', r => r.dmgP90.toFixed(1));
col('damage/turn max %', r => r.dmgMax.toFixed(1));
console.log('\n-- what the card costs its own caster (ticket 152 brake arms) --');
col('self-damage/turn p50 %', r => r.selfP50.toFixed(1));
col('self-damage/turn p90 %', r => r.selfP90.toFixed(1));
col('self-damage/turn max %', r => r.selfMax.toFixed(1));
