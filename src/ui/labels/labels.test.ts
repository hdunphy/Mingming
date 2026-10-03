/**
 * TICKET 183h — the words map and the rewrite for data strings.
 */
import { describe, expect, it } from 'vitest';

import { FIRMWARE_REGISTRY, getOSBehavior } from '../../engine/data/firmwareRegistry';
import { LABELS, OLD_WORDS, instinctName, label, plain, type LabelId } from './labels';

describe('183h labels', () => {
    it('are the ruled words, one per old word', () => {
        expect(LABELS).toEqual({
            firmware: 'Instinct', os: 'Instinct', reflash: 'Retrain', blueprint: 'Trace', assembly: 'Summon',
            workshop: 'Den', daemon: 'Aura', macro: 'Draught', patch: 'Rune', driver: 'Totem',
            scrap: 'Amber', program: 'Card',
        });
    });

    it('pluralise and lower-case on request; Amber has no plural', () => {
        expect(label('macro')).toBe('Draught');
        expect(label('macro', { plural: true })).toBe('Draughts');
        expect(label('patch', { plural: true, lower: true })).toBe('runes');
        expect(label('scrap', { plural: true })).toBe('Amber');
        for (const id of Object.keys(LABELS) as LabelId[]) {
            expect(label(id)).not.toMatch(OLD_WORDS);
        }
    });
});

describe('183h plain()', () => {
    it('rewrites each old word, keeping the capitals', () => {
        expect(plain('Daemon: Gain 1 Sharp.')).toBe('Aura: Gain 1 Sharp.');
        expect(plain('Pick 1 of 3 blueprints')).toBe('Pick 1 of 3 traces');
        expect(plain('Take 15 scrap instead')).toBe('Take 15 amber instead');
        expect(plain('Scrap Cache')).toBe('Amber Cache');
        expect(plain('Marketplace and workshop prices +25%.')).toBe('Marketplace and den prices +25%.');
        expect(plain('It will take one program.')).toBe('It will take one card.');
        expect(plain('Attack programs apply 2 Strengthened')).toBe('Attack cards apply 2 Strengthened');
        expect(plain('Wild Mingmings run their firmware.')).toBe('Wild Mingmings run their instinct.');
        expect(plain("Leaders' Drivers")).toBe("Leaders' Totems");
        expect(plain('Macro Crate')).toBe('Draught Crate');
        expect(plain('A reflashed OS, reflashing again')).toBe('A retrained instinct, retraining again');
        expect(plain('PATCH NOTES')).toBe('RUNE NOTES');
    });

    it('capitalises a new word that starts a sentence', () => {
        expect(plain('OS is active. The OS is on. Use an OS.')).toBe('Instinct is active. The instinct is on. Use an instinct.');
    });

    it('says an Instinct\'s name in Title Case, with no machine word, wherever it appears in a sentence', () => {
        expect(plain('UNBOUND_KERNEL and TIDAL_CRUSH_OS and harden_daemon')).toBe('Unbound and Tidal Crush and harden_daemon');
        expect(plain("Ember's GALE_FORCE_OS creates a retaliatory updraft!")).toBe("Ember's Eagle's Gust creates a retaliatory updraft!");
        expect(plain('Mingming')).toBe('Mingming');
    });

    it('says the verb another way, and mends the article', () => {
        expect(plain('Patch one ally back up.')).toBe('Heal one ally back up.');
        expect(plain('A firmware that holds itself to once a turn')).toBe('An instinct that holds itself to once a turn');
        expect(plain('Needs an assembly and a workshop')).toBe('Needs a summon and a den');
        expect(plain(undefined)).toBeUndefined();
    });

    it('leaves nothing for the sweep to find', () => {
        const text = 'Firmware, OS, reflash, blueprints, assembly, workshop, daemons, macros, patches, drivers, scrap, programs.';
        expect(plain(text).match(OLD_WORDS)).toBeNull();
    });
});

describe('183 instinctName()', () => {
    it('drops the machine word and the capitals', () => {
        expect(instinctName('TIDAL_CRUSH_OS')).toBe('Tidal Crush');
        expect(instinctName('ABYSSAL_INK_SYS')).toBe('Abyssal Ink');
        expect(instinctName('UNBOUND_KERNEL')).toBe('Unbound');
        expect(instinctName('GENESIS_FIRMWARE')).toBe('Ginnungagap');
        expect(instinctName('HOOFBEAT_DAEMON+')).toBe('Hoofbeat Aura+');
        expect(instinctName('GOSSIP_NODE')).toBe('Branch Gossip');
        // A name with no Norse entry is still re-cased and loses its machine word.
        expect(instinctName('SOME_NEW_THING_OS')).toBe('Some New Thing');
        expect(instinctName('EINHERJAR_STANDARD')).toBe('Einherjar Standard');
    });

    it('keeps a name that is only a machine word', () => {
        expect(instinctName('KERNEL')).toBe('Kernel');
    });

    it('gives every Instinct in the registry its own name, with nothing in capitals or with an underscore', () => {
        getOSBehavior('fenrir_v1');
        const seen = new Map<string, string>();
        for (const [id, def] of Object.entries(FIRMWARE_REGISTRY)) {
            const shown = instinctName(def.name);
            expect(shown, id).not.toMatch(/[_]|\b(?:OS|SYS|KERNEL|FIRMWARE)\b|^[A-Z0-9 +]+$/);
            // The upgraded Rune twins share a base name on purpose; only the bodies' own Instincts must differ.
            if (/_v[12]$|^control_v1$|^einherjar_standard$/.test(id)) {
                expect(seen.get(shown), `${id} shares a name with ${seen.get(shown)}`).toBeUndefined();
                seen.set(shown, id);
            }
        }
    });
});
