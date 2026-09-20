/**
 * WHICH SOUND EACH EVENT MAKES — ticket 147d's unit test.
 *
 * 147d: *"every `SfxName` in §4 exists and every listed event maps to one."* These rules are
 * judgements about what a player needs to hear, and every one of them can be wrong in a way that
 * produces no visible symptom — a tick that sounds like a hit, a shield that broke and did not say
 * so. Pure functions of their inputs, so they are checked here rather than by ear.
 */
import { describe, expect, it } from 'vitest';

import {
    castCue, causeCue, cryCue, effectivenessAgainst, HIT_BIG_FRACTION, hookCue, impactCue,
    isPlayerSide, shieldCue, statusCue, SUPER_EFFECTIVE_AT, tickCue,
} from './battleCues';
import { isSampleCue, SAMPLE_FALLBACK } from './sfxSamples';
import { ALL_RECIPE_NAMES } from './sfxRecipes';
import type { IBattleEntity, StatusType } from '../../engine/types';

const unit = (over: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id: 'u1', definitionId: 'fenrir', name: 'Fenrir', maxHp: 100, currentHp: 100,
    primaryElement: 'Nature', secondaryElement: 'None', statusEffects: [], daemons: [],
    cardDraw: 1, maxEnergy: 2, attack: 10, defense: 10, speed: 10, currentEnergy: 2, tempHp: 0,
    blueprintsCollected: 0, attackIV: 0, defenseIV: 0, hpIV: 0,
    ...over,
} as unknown as IBattleEntity);

/** Every cue any rule here can return must be a real, playable name. */
const playable = (cue: string): boolean =>
    isSampleCue(cue) || (ALL_RECIPE_NAMES as readonly string[]).includes(cue);

describe('147d — the impact ladder', () => {
    it('gives super-effective its own sound whatever the element', () => {
        // 147 §1's Pokémon model: the RESULT is what the player needs, and it must sound the same
        // whoever threw it. Fire into Nature is 1.5x.
        expect(effectivenessAgainst('Fire', unit({ primaryElement: 'Nature' }))).toBeGreaterThanOrEqual(SUPER_EFFECTIVE_AT);
        expect(impactCue('Fire', 1.5)).toBe('impactSuper');
        expect(impactCue('Water', 1.5)).toBe('impactSuper');
        expect(impactCue('None', 1.5)).toBe('impactSuper');
    });

    it('gives an ordinary hit its element, and the plain thump where there is none', () => {
        expect(impactCue('Fire', 1)).toBe('impactFire');
        expect(impactCue('Water', 1)).toBe('impactWater');
        expect(impactCue('Nature', 1)).toBe('impactNature');
        // Ice, Light, Dark and None have no element impact in the pack.
        expect(impactCue('Ice', 1)).toBe('impactNormal');
        expect(impactCue('None', 1)).toBe('impactNormal');
        expect(impactCue(undefined, 1)).toBe('impactNormal');
    });

    it('reads effectiveness off the TARGET, never the attacker', () => {
        /*
         * 147 §8: STAB *"is not a sound"* — it shows up as damage size. So this must not need the
         * caster, which is also why it can run off a `DAMAGE_TAKEN` event that carries no caster.
         */
        expect(effectivenessAgainst('Fire', unit({ primaryElement: 'Water' }))).toBe(1);
        expect(effectivenessAgainst('None', unit({ primaryElement: 'Nature' }))).toBe(1);
        expect(effectivenessAgainst('Fire', undefined)).toBe(1);
    });
});

describe('147d — a tick is never an impact', () => {
    it('sounds the status, not the hit', () => {
        // 147 §4, and the most useful thing sound does on this screen: "the board is hurting me"
        // has to be distinguishable from "I am being hit" with your eyes elsewhere.
        expect(tickCue('Burn' as StatusType)).toBe('burnTick');
        expect(tickCue('Poison' as StatusType)).toBe('poisonTick');
        expect(tickCue(undefined)).toBe('poisonTick');
        for (const cue of ['burnTick', 'poisonTick']) {
            expect(cue.startsWith('impact')).toBe(false);
        }
    });

    it('sounds a toll and a recoil as self-inflicted, and an attack as neither', () => {
        expect(causeCue('recoil')).toBe('recoil');
        expect(causeCue('toll')).toBe('recoil');
        expect(causeCue('attack')).toBeNull();
        expect(causeCue(undefined)).toBeNull();
    });
});

describe('147d — the shield says which of three things happened', () => {
    it('distinguishes held, broke, and reduced-to-nothing', () => {
        expect(shieldCue(20, 0)).toBe('blockedByBark');   // the bark took it all
        expect(shieldCue(20, 15)).toBe('barkBreak');      // some got through
        expect(shieldCue(0, 0)).toBe('absorbedNoDamage'); // nothing landed, no shield to credit
        expect(shieldCue(0, 15)).toBeNull();              // an ordinary hit — the impact says it
    });
});

describe('147d — statuses, cries and firmware', () => {
    it('splits buffs from debuffs, and gives the two walls their own cue', () => {
        expect(statusCue('Sharp' as StatusType)).toBe('sharpRaise');
        expect(statusCue('BarkShield' as StatusType)).toBe('barkRaise');
        expect(statusCue('Strengthened' as StatusType)).toBe('buffUp');
        expect(statusCue('Regen' as StatusType)).toBe('buffUp');
        expect(statusCue('Burn' as StatusType)).toBe('debuffDown');
        expect(statusCue('Stunned' as StatusType)).toBe('debuffDown');
    });

    it('cries only for a species the pack covers', () => {
        expect(cryCue('fenrir')).toBe('cry_fenrir');
        expect(cryCue('kraken')).toBe('cry_kraken');
        // The control dummy has no cry, and borrowing somebody else's voice would be worse.
        expect(cryCue('control')).toBeNull();
        expect(cryCue(undefined)).toBeNull();
    });

    it('names an OS cue per species, and falls to the family blip otherwise', () => {
        expect(hookCue(unit({ definitionId: 'fenrir' }), 'CINDER_WALL')).toBe('os_fenrir_CINDER_WALL');
        // The same OS id on a body the pack never covered is not that body's sound.
        expect(hookCue(unit({ definitionId: 'ymir' }), 'CINDER_WALL')).toBe('daemonProc');
        expect(hookCue(undefined, 'CINDER_WALL')).toBe('daemonProc');
        expect(hookCue(unit(), undefined, 'some_daemon')).toBe('daemonProc');
    });
});

describe('147d — casts, sides, and the promise that every rule names a real cue', () => {
    it('casts the element, and the plain whoosh for the rest', () => {
        expect(castCue('Fire')).toBe('castFire');
        expect(castCue('Water')).toBe('castWater');
        expect(castCue('Nature')).toBe('castNature');
        expect(castCue('Ice')).toBe('castNone');
        expect(castCue(undefined)).toBe('castNone');
    });

    it('knows whose side a unit is on, and survives having no state', () => {
        const state = { playerParty: [unit({ id: 'mine' })] };
        expect(isPlayerSide(state, 'mine')).toBe(true);
        expect(isPlayerSide(state, 'theirs')).toBe(false);
        expect(isPlayerSide(null, 'mine')).toBe(false);
    });

    it('never returns a cue that cannot be played', () => {
        /*
         * The guard that matters most: a typo in any rule above is a SILENT cue, and silence is
         * the one failure mode nothing else in this suite would notice.
         */
        const produced = [
            castCue('Fire'), castCue(undefined),
            impactCue('Fire', 1), impactCue('Water', 1), impactCue('Nature', 1),
            impactCue('Ice', 1), impactCue('Fire', 2),
            tickCue('Burn' as StatusType), tickCue('Poison' as StatusType),
            causeCue('recoil'), shieldCue(1, 0), shieldCue(1, 1), shieldCue(0, 0),
            statusCue('Sharp' as StatusType), statusCue('BarkShield' as StatusType),
            statusCue('Strengthened' as StatusType), statusCue('Burn' as StatusType),
            cryCue('fenrir'), hookCue(unit(), 'CINDER_WALL'), hookCue(unit(), 'NOPE'),
            'hitBig', 'kill', 'cardFly', 'cardDiscard', 'shuffle', 'statusOff', 'turnEnd',
        ].filter((cue): cue is string => cue !== null);

        for (const cue of produced) expect(playable(cue), `${cue} is not playable`).toBe(true);
        // And each sampled one can still be heard before its buffer lands, except the cries.
        for (const cue of produced) {
            if (!isSampleCue(cue) || cue.startsWith('cry_')) continue;
            expect(SAMPLE_FALLBACK[cue], `${cue} has no fallback`).not.toBeNull();
        }
    });

    it('layers the sub-thump at the fraction the ticket names', () => {
        expect(HIT_BIG_FRACTION).toBe(0.35);
    });
});
