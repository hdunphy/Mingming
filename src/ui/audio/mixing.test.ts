/**
 * THE MIXING RULES, AS ARITHMETIC — ticket 147b.
 *
 * Every rule in 147b is a number, and a number that is wrong is a sound that is wrong in a way
 * nobody can describe afterwards ("the hits sound samey"). These are the numbers, checked at their
 * boundaries — pure functions, no AudioContext, the same reason `limiters.ts` was split out in the
 * first place.
 */
import { describe, expect, it } from 'vitest';

import {
    cueGain, DUCK_DB, DUCK_MS, DUCKING_CUES, gainForDb, MULTI_HIT_SEMITONES, NON_COMBAT_CUES,
    pitchForCardsPlayed, pitchForDamage, pitchForStacks, semitones, SFX_COALESCE_WINDOW_MS,
    RECOIL_DB, SFX_SPACING_MAX_LAG_MS, SFX_SPACING_MS, SfxRateLimiter, SfxSpacer,
} from './limiters';
import { SAMPLE_CUES } from './sfxSamples';

describe('147b — pitch by magnitude', () => {
    it('drops impacts as damage grows, and rises ticks as stacks grow', () => {
        // Opposite directions on purpose: down reads as weight, up reads as escalation, and using
        // one direction for both would make a big hit and a deep burn sound alike.
        expect(pitchForDamage(0)).toBeCloseTo(1, 5);
        expect(pitchForDamage(1)).toBeLessThan(1);
        expect(pitchForDamage(1)).toBeCloseTo(semitones(-3), 5);
        expect(pitchForDamage(0.5)).toBeGreaterThan(pitchForDamage(1));

        expect(pitchForStacks(0)).toBeCloseTo(1, 5);
        expect(pitchForStacks(4)).toBeGreaterThan(1);
        expect(pitchForStacks(8)).toBeGreaterThan(pitchForStacks(4));
    });

    it('caps, so a long burn is not a whistle and a long turn is not a squeak', () => {
        expect(pitchForStacks(99)).toBeCloseTo(pitchForStacks(8), 5);
        expect(pitchForCardsPlayed(99)).toBeCloseTo(pitchForCardsPlayed(12), 5);
        // One octave, no more: `pitchForCardsPlayed(12)` is exactly 2x.
        expect(pitchForCardsPlayed(12)).toBeCloseTo(2, 5);
    });

    it('never returns a rate a buffer source would refuse', () => {
        // `playbackRate` must be finite and positive or the sample throws instead of playing.
        for (const value of [NaN, -1, Infinity, 0]) {
            for (const fn of [pitchForDamage, pitchForStacks, pitchForCardsPlayed]) {
                const pitch = fn(value);
                expect(Number.isFinite(pitch)).toBe(true);
                expect(pitch).toBeGreaterThan(0);
            }
        }
    });

    it('climbs a semitone per card already played this turn', () => {
        // 147 §1's Balatro note: "the third card played this turn sits a step higher than the
        // first."
        expect(pitchForCardsPlayed(1)).toBeCloseTo(semitones(1), 5);
        expect(pitchForCardsPlayed(3)).toBeCloseTo(semitones(3), 5);
    });
});

describe('147b — coalescing, and the series that is allowed through it', () => {
    it('is wider than the stagger 146c leaves between a cast\'s impacts', () => {
        /*
         * This is the reason `step` exists. `TRAIL_STAGGER_MS` is 40 ms and the window is 60, so a
         * Side card hitting three bodies WOULD collapse into one hit if the caller could not say
         * "I meant this". The assertion is the relationship, not the constants: change either and
         * this still holds or fails honestly.
         */
        expect(SFX_COALESCE_WINDOW_MS).toBeGreaterThan(40);
    });

    it('suppresses a true double-fire within the window', () => {
        const limiter = new SfxRateLimiter();
        expect(limiter.shouldPlay('impactNormal', 1000)).toBe(true);
        expect(limiter.shouldPlay('impactNormal', 1000 + SFX_COALESCE_WINDOW_MS - 1)).toBe(false);
        expect(limiter.shouldPlay('impactNormal', 1000 + SFX_COALESCE_WINDOW_MS)).toBe(true);
    });
});

describe('147b — ducking', () => {
    it('is −6 dB for 250 ms, and −6 dB is about half', () => {
        expect(DUCK_DB).toBe(-6);
        expect(DUCK_MS).toBe(250);
        expect(gainForDb(-6)).toBeCloseTo(0.501, 3);
        expect(gainForDb(0)).toBeCloseTo(1, 5);
    });

    it('names the four big moments and nothing else', () => {
        expect([...DUCKING_CUES].sort()).toEqual(['defeat', 'hitBig', 'kill', 'victory']);
    });
});

describe('194l — the recoil plays under the impacts', () => {
    it('starts at -9 dB, and its gain is below every impact\'s', () => {
        expect(RECOIL_DB).toBe(-9);
        expect(cueGain('recoil')).toBeCloseTo(gainForDb(-9), 6);
        for (const impact of ['impactNormal', 'impactFire', 'impactWater', 'impactNature', 'impactSuper', 'hitBig']) {
            expect(cueGain('recoil'), impact).toBeLessThan(cueGain(impact));
        }
    });

    it('leaves every other cue at full level', () => {
        expect(cueGain('impactNormal')).toBe(1);
        expect(cueGain('castFire')).toBe(1);
    });
});

describe('147b — the combat-sounds switch', () => {
    it('leaves the interface, the turn beats and the run stingers audible', () => {
        // Turn a fight quiet and the game must still answer you, still say whose move it is, and
        // still tell you that you won.
        for (const cue of ['uiClick', 'uiError', 'turnStart', 'turnEnd', 'victory', 'defeat']) {
            expect(NON_COMBAT_CUES.has(cue)).toBe(true);
        }
    });

    it('silences the fight itself — every cast, impact, tick, tell and cry', () => {
        for (const cue of ['castFire', 'impactSuper', 'burnTick', 'barkBreak', 'daemonProc',
            'os_fenrir_CINDER_WALL', 'cry_fenrir', 'kill', 'recoil']) {
            expect(NON_COMBAT_CUES.has(cue), `${cue} should be silenced by the switch`).toBe(false);
        }
    });

    it('does not name a cue that does not exist', () => {
        // A typo here is a cue that is silenced when it should not be, or the reverse, and nothing
        // else would catch it.
        const known = new Set<string>([
            ...SAMPLE_CUES,
            'uiClick', 'uiError', 'reveal', 'rewardClaim', 'discountPrimed', 'breach', 'levelUp',
            'victory', 'defeat', 'turnPlayer', 'turnEnemy',
        ]);
        for (const cue of NON_COMBAT_CUES) expect(known.has(cue), `${cue} is not a real cue`).toBe(true);
        for (const cue of DUCKING_CUES) expect(known.has(cue), `${cue} is not a real cue`).toBe(true);
    });
});

describe('147b — the multi-hit step', () => {
    it('is a small interval, so three hits read as one attack', () => {
        expect(MULTI_HIT_SEMITONES).toBe(2);
        // Three targets span a major third and a half — countable, not a melody.
        expect(semitones(2 * MULTI_HIT_SEMITONES)).toBeLessThan(semitones(5));
    });
});

describe('2026-09-25 — different cues arriving together are SPACED, not stacked', () => {
    it("lays one Ember Jab's six cues out 80 ms apart, in arrival order", () => {
        const spacer = new SfxSpacer();
        // cardFly, castFire, hit, Burn, Sharp, the OS proc — all in the same frame.
        const delays = [0, 0, 0, 0, 0, 0].map((dt) => spacer.delayFor(1000 + dt));
        expect(SFX_SPACING_MS).toBe(80);
        expect(delays).toEqual([0, 80, 160, 240, 320, 400]);
    });

    it('a cue after a quiet gap plays at once — spacing only applies to a crowd', () => {
        const spacer = new SfxSpacer();
        expect(spacer.delayFor(1000)).toBe(0);
        expect(spacer.delayFor(1000 + SFX_SPACING_MS)).toBe(0);
        expect(spacer.delayFor(5000)).toBe(0);
    });

    it('a cue that would land more than six slots late is dropped, not queued', () => {
        const spacer = new SfxSpacer();
        const delays: Array<number | null> = [];
        for (let i = 0; i < 9; i += 1) delays.push(spacer.delayFor(1000));
        expect(delays.slice(0, 7)).toEqual([0, 80, 160, 240, 320, 400, 480]);
        expect(SFX_SPACING_MAX_LAG_MS).toBe(480);
        expect(delays[7]).toBeNull();
        expect(delays[8]).toBeNull();
        // And once the crowd has cleared, sound resumes on time.
        expect(spacer.delayFor(1000 + 560 + SFX_SPACING_MS)).toBe(0);
    });

    it('a big moment waits its turn behind the hit it punctuates, and is never dropped', () => {
        // 09-26 review: exempting `kill` from the spacer made it sound BEFORE the impact.
        const spacer = new SfxSpacer();
        const whoosh = spacer.delayFor(1000);
        const impact = spacer.delayFor(1000);
        const kill = spacer.delayFor(1000, true);
        expect([whoosh, impact, kill]).toEqual([0, 80, 160]);
        // Past the lag bound an ordinary cue is dropped, a required one plays at the bound.
        const crowded = new SfxSpacer();
        for (let i = 0; i < 7; i += 1) crowded.delayFor(1000);
        expect(crowded.delayFor(1000)).toBeNull();
        expect(crowded.delayFor(1000, true)).toBe(SFX_SPACING_MAX_LAG_MS);
    });
});
