import { generateRegionGraph, REGION_PARAMS } from '../src/engine/run/regionGraph';
let missingRival = 0, missingScout = 0, noFightNodes = 0;
for (let s = 0; s < 400; s += 1) {
    const g = generateRegionGraph(`cov-${s}`);
    if (g.nodes.filter(n => n.scout).length !== 1) missingScout += 1;
    for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
        const mids = g.nodes.filter(n => n.biomeIndex === b && n.layer >= 1 && n.layer <= 3);
        const rivals = mids.filter(n => n.kind === 'rival').length;
        const fights = mids.filter(n => ['wild', 'rival', 'elite'].includes(n.kind)).length;
        if (rivals === 0) { missingRival += 1; if (fights === 0) noFightNodes += 1; }
    }
}
console.log({ seeds: 400, biomes: 1200, missingRival, missingScout, noFightNodes });
