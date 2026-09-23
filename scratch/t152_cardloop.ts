/** How deep does ONE named card get cast in a single turn? Ticket 152's condition check. */
import fs from 'node:fs';
const card = process.argv[process.argv.length - 1];
for (const f of process.argv.slice(2).filter(a => a.endsWith('.jsonl'))) {
    const games = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const perTurn: number[] = [];
    for (const g of games) {
        const byTurn = new Map<number, number>();
        for (const c of g.casts) if (c.card === card) byTurn.set(c.turn, (byTurn.get(c.turn) ?? 0) + 1);
        // Turns in which the card was cast at all, plus the turns it was not (so the rate is honest).
        const turns = new Set<number>(g.casts.map((c: { turn: number }) => c.turn));
        for (const t of turns) perTurn.push(byTurn.get(t) ?? 0);
    }
    const six = perTurn.filter(n => n >= 6).length;
    const three = perTurn.filter(n => n >= 3).length;
    console.log(`${f.split('/').pop()!.replace('.jsonl','').padEnd(26)} ${card.padEnd(10)} `
        + `turns ${String(perTurn.length).padStart(5)}  >=3 ${(three / perTurn.length * 100).toFixed(1)}%  `
        + `>=6 ${(six / perTurn.length * 100).toFixed(1)}%  max ${Math.max(0, ...perTurn)}`);
}
