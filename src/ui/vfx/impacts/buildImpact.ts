/**
 * TICKET 190e - THE BURST WHERE AN ATTACK LANDS, as seeds. Fire, Water and Nature each throw their
 * own; every other element throws streaks in its colour and None throws white ones. On top of that:
 * a super-effective hit adds a white ring and star sparks, a resisted one a grey fizzle (and a small
 * grey ring instead of a coloured one), a kill a white ring.
 *
 * The count is `impactCount`: round((12 + 26 s) x matchup x the tier's particleScale).
 */

import type { ParticleSeed } from '../particles';
import type { TrailElement } from '../trails';
import type { ImpactInput } from './ImpactInput';
import { fireImpact } from './fireImpact';
import { impactCount } from './impactCount';
import { FIZZLE_GREY, killRing, resistedFx, superEffectiveFx } from './matchupFx';
import { natureImpact } from './natureImpact';
import { plainImpact } from './plainImpact';
import { ringSeed } from './ringSeed';
import { waterImpact } from './waterImpact';

const WHITE = { r: 255, g: 255, b: 255 };

export function buildImpact(element: TrailElement, input: ImpactInput): ParticleSeed[] {
    const rng = input.rng ?? Math.random;
    const withRng: ImpactInput = { ...input, rng };
    const count = impactCount(input.s, input.matchup, input.particleScale);
    const resisted = input.matchup === 'resisted';

    // The edge first: coloured for the element, small and grey when the hit was resisted.
    const seeds: ParticleSeed[] = [
        resisted
            ? ringSeed(input.at, FIZZLE_GREY, 4 + 2 * input.s, 300)
            : ringSeed(input.at, input.color, 5 + 3 * input.s, 340),
    ];

    switch (element) {
        case 'Fire': seeds.push(...fireImpact(withRng, count)); break;
        case 'Water': seeds.push(...waterImpact(withRng, count)); break;
        case 'Nature': seeds.push(...natureImpact(withRng, count)); break;
        case 'None': seeds.push(...plainImpact(withRng, count, WHITE)); break;
        default: seeds.push(...plainImpact(withRng, count, input.color)); break;
    }

    if (input.matchup === 'super') seeds.push(...superEffectiveFx(input.at, input.s, input.direction, rng));
    if (resisted) seeds.push(...resistedFx(input.at, input.direction, rng));
    if (input.isKill) seeds.push(killRing(input.at, input.s));
    return seeds;
}
