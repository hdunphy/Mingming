import fs from 'node:fs';
for (const f of process.argv.slice(2).filter(a => a.endsWith('.jsonl'))) {
    const games = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    let w = 0, d = 0;
    for (const g of games) { if (g.winner === 'PLAYER') { w++; d++; } else if (g.winner === 'ENEMY') d++; }
    console.log(`${f.split('/').pop()!.replace('.jsonl','').padEnd(24)} games ${String(games.length).padStart(5)}  field ${(d ? w / d * 100 : 0).toFixed(1)}%`);
}
