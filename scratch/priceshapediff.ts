/**
 * Ticket 102: did the re-denomination actually move any CARD PRICE?
 *
 * The pricing table was reworked for POWER (streamStacks no longer clamps; the stream constants are
 * derived from the power-per-stack over a 5-attack horizon). The question Henry asked - which cards
 * redline now - only has a meaningful answer if the answer changed. This runs the whole registry
 * through the pricer under both shapes in one process and prints every card whose score moved.
 *
 * env: SHAPE_A (default PERCENT), SHAPE_B (default POWER)
 */
import { STATUS_MODEL } from '../src/engine/core/Hooks';

const A = (process.env.SHAPE_A ?? 'PERCENT') as 'PERCENT' | 'POWER';
const B = (process.env.SHAPE_B ?? 'POWER') as 'PERCENT' | 'POWER';

async function priceAll(shape: 'PERCENT' | 'POWER', pwr?: number): Promise<Map<string, number>> {
    STATUS_MODEL.shape = shape;
    if (pwr !== undefined) STATUS_MODEL.powerPerStack = pwr;
    // Fresh module instance so the top-level stream constants are re-derived under this shape.
    const mod = await import(`../src/debug/balance/powerscale?shape=${shape}&pwr=${pwr ?? 'def'}`);
    const { ProgramRegistry } = await import('../src/engine/data/programRegistry');
    const out = new Map<string, number>();
    for (const [id, data] of Object.entries(ProgramRegistry as Record<string, any>)) {
        if (typeof data.baseCost !== 'number') continue;
        const r = mod.calculatePowerscale(data);
        if (r.score === undefined || Number.isNaN(r.score)) continue;
        out.set(id, Number(r.score.toFixed(4)));
    }
    return out;
}

const a = await priceAll(A, process.env.PWR_A ? Number(process.env.PWR_A) : undefined);
const b = await priceAll(B, process.env.PWR_B ? Number(process.env.PWR_B) : undefined);

const moved: Array<[string, number, number]> = [];
for (const [id, va] of a) {
    const vb = b.get(id);
    if (vb !== undefined && Math.abs(vb - va) > 1e-6) moved.push([id, va, vb]);
}
moved.sort((x, y) => Math.abs(y[2] - y[1]) - Math.abs(x[2] - x[1]));

console.error(`priced under ${A}: ${a.size}   under ${B}: ${b.size}`);
console.error(`cards whose SCORE moved: ${moved.length}`);
for (const [id, va, vb] of moved.slice(0, 40))
    console.error(`  ${id.padEnd(24)}${va.toFixed(2).padStart(8)} -> ${vb.toFixed(2).padStart(8)}   ${(vb - va >= 0 ? '+' : '')}${(vb - va).toFixed(2)}`);
