/**
 * TICKET 190d — the glow the attacks draw heads and muzzles with. TICKET 198b-1: it is the lab's
 * `drawGlowAt` (additive, the white-centred `tex` sprite) from `glowTexture.ts`; the dark-rimmed
 * sprite and the ordinary blending that 194k-3 put here are gone. Light is drawn additively again,
 * onto the particle layer's own transparent canvas, which the browser lays over the stage in
 * ordinary blending: the effects sum among themselves, and the result covers a light backdrop where
 * it is dense instead of disappearing into it (see `ParticleLayer`).
 */

export { drawGlowAt, glowTexture } from '../glowTexture';

/** How light is blended among the effects: the lab's `lighter`. */
export const LIGHT_BLEND: GlobalCompositeOperation = 'lighter';
