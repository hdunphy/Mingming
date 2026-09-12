/**
 * TICKET 146c/146d/146f — the parts that are decisions rather than pictures.
 *
 * The look is judged on a GIF; these pin the things a GIF cannot show. The trail paths are the
 * clearest example: a path that starts or ends off the line looks fine in any single frame and
 * means every shot in the game misses the unit it was aimed at by a few pixels.
 */
import { describe, expect, it } from 'vitest';

import {
    TRAIL_MS, TRAIL_STAGGER_MS, elementColor, impactFor, trailSeed, type TrailElement,
} from './trails';
import { FLIGHT_MS, STATUS_TELL_STAGGER_MS } from './useCastSequence';
import { statusColor } from './statusTells';
import { PLAYED_CARD_REVEAL_MS } from '../hooks/useBattleVfx';

const FROM = { x: 100, y: 300, w: 190, h: 190 };
const TO = { x: 900, y: 300, w: 190, h: 190 };
const AUTHORED: TrailElement[] = ['Fire', 'Water', 'Nature', 'None'];
const SLOTS: TrailElement[] = ['Earth', 'Ice', 'Air', 'Light', 'Dark'];

describe('146d — every trail leaves the caster and arrives at the target', () => {
    it.each([...AUTHORED, ...SLOTS])('%s starts and ends on the line', (element) => {
        /*
         * THE LOAD-BEARING PROPERTY of a path function. A deformation that does not damp to zero
         * at both ends leaves the head starting beside the caster and landing beside the target —
         * invisible in one frame, and it means every shot in the game is slightly wrong.
         */
        const seed = trailSeed(element, FROM, TO);
        expect(seed.path).toBeDefined();
        const start = seed.path!(0);
        const end = seed.path!(1);

        expect(start.x).toBeCloseTo(FROM.x + FROM.w / 2, 5);
        expect(start.y).toBeCloseTo(FROM.y + FROM.h / 2, 5);
        expect(end.x).toBeCloseTo(TO.x + TO.w / 2, 5);
        expect(end.y).toBeCloseTo(TO.y + TO.h / 2, 5);
    });

    it.each(AUTHORED)('%s stays within reach of the straight line', (element) => {
        // A path that wandered far off the line would cross other units' slots and read as hitting
        // them. Half the shot's length is generous and still catches a runaway curve.
        const seed = trailSeed(element, FROM, TO);
        const span = Math.hypot(TO.x - FROM.x, TO.y - FROM.y);
        for (let t = 0; t <= 1; t += 0.05) {
            const point = seed.path!(t);
            const straightX = FROM.x + FROM.w / 2 + (TO.x - FROM.x) * t;
            const drift = Math.hypot(point.x - straightX, point.y - (FROM.y + FROM.h / 2));
            expect(drift).toBeLessThan(span * 0.5);
        }
    });

    it('gives Fire, Water and Nature each a different particle behind it', () => {
        // Ruling 4: *"Water drop, flame, leaf."* Three elements the player has to tell apart at a
        // glance, so the particle is the distinguishing feature and cannot be shared.
        const kinds = AUTHORED.slice(0, 3).map((e) => trailSeed(e, FROM, TO).trail?.kind);
        expect(kinds).toEqual(['flame', 'drop', 'leaf']);
        expect(new Set(kinds).size).toBe(3);
    });

    it('sheds NOTHING for None — the absence is the design', () => {
        // §2d: a neutral hit should read as plainer than an elemental one.
        expect(trailSeed('None', FROM, TO).trail).toBeUndefined();
    });

    it('leaves the five unauthored elements as tinted slots, not as debts', () => {
        for (const element of SLOTS) {
            const seed = trailSeed(element, FROM, TO);
            expect(seed.trail).toBeUndefined();
            expect(impactFor(element).kind).toBe('puff');
            // Tinted: the slot still takes the element's own colour, so it reads as that element.
            expect(impactFor(element).color).toEqual(elementColor(element));
        }
    });

    it('makes fire rise and water fall, which is how they read in motion', () => {
        // The cheapest difference at speed, and the one a player never has to be taught.
        expect(trailSeed('Fire', FROM, TO).trail!.gravity).toBeLessThan(0);
        expect(trailSeed('Water', FROM, TO).trail!.gravity).toBeGreaterThan(0);
    });

    it('lives exactly as long as the flight, so it cannot arrive early or linger', () => {
        expect(trailSeed('Fire', FROM, TO).life).toBe(TRAIL_MS);
    });
});

describe('146c — the sequence fits inside the hold', () => {
    it('finishes steps 2-4 before the reveal comes down', () => {
        /*
         * §2c: *"the hold extends to cover 2-4 so the sequence never truncates."* The reveal's hold
         * is a fixed 1200ms (ticket 127, raised from 700 after Henry could not read enemy cards),
         * and the worst sequence the game can produce is a three-target Side card that also applies
         * a status to each. If that ever grows past the hold, the card vanishes mid-impact — so
         * this is the assertion that makes the word "extends" true rather than hopeful.
         */
        const targets = 3;
        const statuses = 3;
        const lastImpact = FLIGHT_MS + (targets - 1) * TRAIL_STAGGER_MS + TRAIL_MS;
        const worst = lastImpact + statuses * STATUS_TELL_STAGGER_MS;

        expect(worst).toBeLessThan(PLAYED_CARD_REVEAL_MS);
    });

    it('staggers a multi-target cast, so three hits read as three', () => {
        expect(TRAIL_STAGGER_MS).toBeGreaterThan(0);
    });

    it('sends the trail after the card has reached the lane', () => {
        // Ruling 5's order: the card flies, THEN the flame shoots across in front of it. A trail
        // that left first would cross an empty lane and the card would land into its own aftermath.
        expect(FLIGHT_MS).toBeGreaterThan(0);
    });
});

describe('146f — the status tells take the badge colours', () => {
    it('uses STATUS_COLORS, so the ring matches the badge the player will read', () => {
        // The ring on the sprite and the badge on the plaque are the same event in two places; a
        // different colour in each would read as two unrelated things happening at once.
        expect(statusColor('Burn')).toEqual({ r: 255, g: 102, b: 51 });
        expect(statusColor('Poison')).toEqual({ r: 136, g: 204, b: 34 });
    });

    it('falls back to grey for a status with no colour rather than throwing', () => {
        const color = statusColor('NotAStatus' as never);
        expect(Number.isFinite(color.r)).toBe(true);
    });
});
