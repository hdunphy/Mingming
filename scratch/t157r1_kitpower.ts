/**
 * 157-r1's diagnostic: what each of the twelve start fives is actually WORTH, by 149c.
 *
 * Read after the fight-one table, to answer the question that table raises: fight one spreads from
 * 19% to 98% across the twelve, and the two sides hold the same SHAPE, so the spread has to be in
 * what the shape is filled with. Scratch rather than `src/debug`: it answers one row's question and
 * the deck browser already reports per-card scores for every other purpose.
 */
import { MingmingRegistry, LAUNCH_SPECIES } from '../src/engine/data/mingmingRegistry';
import { calculatePowerscale } from '../src/debug/balance/powerscale';
import { GetProgramData } from '../src/engine/data/programRegistry';

const score = (id: string): number | null => {
    try { const c = GetProgramData(id); return c ? calculatePowerscale(c).score : null; } catch { return null; }
};

for (const sp of LAUNCH_SPECIES) {
    const def = MingmingRegistry[sp];
    for (const os of def.availableOS) {
        const kit = def.startKits?.[os] ?? [];
        const scores = kit.map((id) => ({ id, s: score(id) }));
        const total = scores.reduce((n, r) => n + (r.s ?? 0), 0);
        console.log(
            `${os.padEnd(17)} ${String(def.primaryElement).padEnd(7)} total ${total.toFixed(2).padStart(6)}`
            + `  mean ${(total / Math.max(1, kit.length)).toFixed(2)}   `
            + scores.map((r) => `${r.id}${r.s === null ? '(?)' : `@${r.s.toFixed(2)}`}`).join(' · '),
        );
    }
}
