/**
 * TICKET 190e — THE BURST WHERE AN ATTACK LANDS, composed the way the lab's `impact()` composes it
 * (TICKET 198b-4): the element's own burst (which carries its own ring), sized by the damage scale,
 * the matchup and the tier's particle multiplier; then the big white ring and stars for a
 * super-effective hit OR a kill; then the grey fizzle for a resisted one.
 */

import type { ParticleSeed } from '../particles';
import type { TrailElement } from '../trails';
import type { ImpactInput } from './ImpactInput';
import { fireImpact } from './fireImpact';
import { impactCount } from './impactCount';
import { fizzle, superRing } from './matchupFx';
import { natureImpact } from './natureImpact';
import { plainImpact } from './plainImpact';
import { waterImpact } from './waterImpact';

const WHITE = { r: 255, g: 255, b: 255 };

export function buildImpact(element: TrailElement, input: ImpactInput): ParticleSeed[] {
    const rng = input.rng ?? Math.random;
    const withRng: ImpactInput = { ...input, rng };
    const count = impactCount(input.s, input.matchup, input.particleScale);
    const seeds: ParticleSeed[] = [];

    switch (element) {
        case 'Fire': seeds.push(...fireImpact(withRng, count)); break;
        case 'Water': seeds.push(...waterImpact(withRng, count)); break;
        case 'Nature': seeds.push(...natureImpact(withRng, count)); break;
        case 'None': seeds.push(...plainImpact(withRng, count, WHITE)); break;
        default: seeds.push(...plainImpact(withRng, count, input.color)); break;
    }

    if (input.matchup === 'super' || input.isKill) seeds.push(...superRing(input.at));
    if (input.matchup === 'resisted') seeds.push(...fizzle(input.at, rng));
    return seeds;
}
