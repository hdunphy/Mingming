/**
 * TICKET 190c — WHEN each thing of a cast happens, as game milliseconds from the start of its beat.
 * The pose, the element leaving, the hit, the card going and the end all come from the tier profile.
 */
import { describe, expect, it } from 'vitest';

import { TIER_PROFILES } from '../tiers/tierProfiles';
import { castTimes } from './castTimes';

const hit = { damage: 45, maxHp: 100, isKill: false } as const;
const SHOWY = TIER_PROFILES.showy;

describe('190c — the timeline of a ranged attack', () => {
    const t = castTimes(SHOWY, { kind: 'attack', fromPlayer: true, ...hit });

    it('starts the wind-up with the card (the card flies in DURING the wind-up)', () => {
        expect(t.cardInAtMs).toBe(0);
        expect(t.poseAtMs).toBe(0);
    });

    it('launches the element when the lunge ends, and lands the hit when the travel ends', () => {
        expect(t.launchAtMs).toBe(220 + 150);
        expect(t.travelMs).toBe(260 + 600);
        expect(t.impactAtMs).toBe(t.launchAtMs + t.travelMs);
    });

    it('holds the lunge through the knock-back, then the attacker walks back as the card leaves', () => {
        expect(t.returnAtMs).toBe(t.impactAtMs + 170);
        expect(t.cardOutAtMs).toBe(t.returnAtMs);
        expect(t.endAtMs).toBe(t.returnAtMs + 200);
    });

    it('lasts until the card has gone, whichever is later', () => {
        expect(t.beatEndMs).toBe(Math.max(t.endAtMs, t.cardOutAtMs + SHOWY.cardOutMs));
    });
});

describe('190c — an enemy card hovers before its attack', () => {
    it('starts the wind-up after the card has arrived and hovered a second', () => {
        const t = castTimes(SHOWY, { kind: 'attack', fromPlayer: false, ...hit });
        expect(t.poseAtMs).toBe(SHOWY.cardInMs + 1000);
        expect(t.launchAtMs).toBe(t.poseAtMs + 370);
    });

    it('hovers the same second at every tier', () => {
        for (const profile of Object.values(TIER_PROFILES)) {
            const t = castTimes(profile, { kind: 'attack', fromPlayer: false, ...hit });
            expect(t.poseAtMs).toBe(profile.cardInMs + 1000);
        }
    });
});

describe('190c — a contact card', () => {
    const t = castTimes(SHOWY, { kind: 'contact', fromPlayer: true, ...hit });

    it('has no travel: the hit lands when the dash ends', () => {
        expect(t.travelMs).toBe(0);
        expect(t.launchAtMs).toBe(220);
        expect(t.impactAtMs).toBe(220 + 1.6 * 150);
    });
});

describe('190c — a status-only card', () => {
    const t = castTimes(SHOWY, { kind: 'status', fromPlayer: true, damage: 0, maxHp: 100, isKill: false });

    it('wiggles, then lobs the orb, then the status lands: no lunge', () => {
        expect(t.poseAtMs).toBe(0);
        expect(t.launchAtMs).toBe(300);
        expect(t.impactAtMs).toBe(300 + 320);
        expect(t.endAtMs).toBe(300 + 320 + 520);
    });

    it('lets the card go when the landing is over', () => {
        expect(t.cardOutAtMs).toBe(t.endAtMs);
    });
});

describe('190c — the tiers', () => {
    it('Snappy is quicker than Showy is quicker than Slow, start to end', () => {
        const total = (key: 'slow' | 'showy' | 'snappy') =>
            castTimes(TIER_PROFILES[key], { kind: 'attack', fromPlayer: true, ...hit }).beatEndMs;
        expect(total('snappy')).toBeLessThan(total('showy'));
        expect(total('showy')).toBeLessThan(total('slow'));
    });
});
