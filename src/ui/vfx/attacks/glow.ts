/**
 * TICKET 190d — the glow the attacks draw heads and muzzles with. TICKET 198b-1: it is the lab's
 * `drawGlowAt` (additive, the white-centred `tex` sprite) from `glowTexture.ts`; the dark-rimmed
 * sprite and the ordinary blending that 194k-3 put here are gone. Light is drawn additively again:
 * the particle layer composites the whole effect over the stage in ordinary blending, so additive
 * light no longer disappears over a light backdrop (see `ParticleLayer`).
 */

export { drawGlowAt, glowTexture } from '../glowTexture';

/** How light is blended among the effects: the lab's `lighter`. */
export const LIGHT_BLEND: GlobalCompositeOperation = 'lighter';
