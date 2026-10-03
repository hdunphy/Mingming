/**
 * TICKET 183i — the Norse Instinct names Henry approved on 2026-10-03 ("accept all"). The table below
 * is the approved list, written out by hand, so a stray edit to `instinctNames.ts` fails here.
 */
import { describe, expect, it } from 'vitest';

import { FIRMWARE_REGISTRY, getOSBehavior } from '../../engine/data/firmwareRegistry';
import { NORSE_INSTINCT_NAMES, norseInstinctName } from './instinctNames';
import { instinctName, plain } from './labels';

/** species instinct id -> the name a player reads. */
const APPROVED: ReadonlyArray<readonly [string, string]> = [
    ['fenrir_v1', 'Unbound'],
    ['fenrir_v2', 'Muspel Wall'],
    ['kraken_v1', 'Abyssal Ink'],
    ['kraken_v2', 'Tidal Crush'],
    ['fafnir_v1', "Dragon's Hoard"],
    ['fafnir_v2', "Andvari's Curse"],
    ['skoll_v1', 'Treachery'],
    ['skoll_v2', 'Sunscorch'],
    ['jormungandr_v1', 'Midgard Coil'],
    ['jormungandr_v2', 'Venomfang'],
    ['gullinbursti_v1', 'Golden Bristles'],
    ['gullinbursti_v2', 'Tuskrush'],
    ['hraesvelgr_v1', "Eagle's Gust"],
    ['hraesvelgr_v2', 'Stormrise'],
    ['sleipnir_v1', 'Eightfold Stride'],
    ['sleipnir_v2', "Odin's Charge"],
    ['ratatoskr_v1', 'Branch Gossip'],
    ['ratatoskr_v2', 'Tale-Bearer'],
    ['huldra_v1', 'Glamour'],
    ['huldra_v2', 'Elderwood Ward'],
    ['ymir_v1', 'Rimeheart'],
    ['ymir_v2', 'Jötun Patience'],
    ['draugr_v1', 'Restless Dead'],
    ['draugr_v2', 'Barrow Chill'],
    ['valkyrie_v1', "Valhalla's Call"],
    ['valkyrie_v2', 'Folkvangr Dawn'],
    ['audhumbla_v1', 'Ginnungagap'],
    ['audhumbla_v2', 'Elder Milk'],
    ['control_v1', 'Unmarked'],
    ['hel_v1', 'Twin Faces'],
    ['hel_v2', 'Helgrind'],
    ['nidhoggr_v1', 'Rootgnaw'],
    ['nidhoggr_v2', 'Carrion Hunger'],
];

describe('183i Norse Instinct names', () => {
    it('are the 33 approved names, one per species Instinct', () => {
        expect(APPROVED).toHaveLength(33);
        expect(Object.keys(NORSE_INSTINCT_NAMES)).toHaveLength(33);
        for (const [id, shown] of APPROVED) {
            const def = getOSBehavior(id);
            expect(def, `${id} is in the registry`).toBeDefined();
            expect(instinctName(def!.name), id).toBe(shown);
        }
    });

    it('keeps the four names that were already fine', () => {
        expect(instinctName('UNBOUND_KERNEL')).toBe('Unbound');
        expect(instinctName('ABYSSAL_INK_SYS')).toBe('Abyssal Ink');
        expect(instinctName('TIDAL_CRUSH_OS')).toBe('Tidal Crush');
        expect(instinctName('TREACHERY_KERNEL')).toBe('Treachery');
    });

    it('never repeats a name, and no table key is a name the registry does not have', () => {
        const shown = Object.values(NORSE_INSTINCT_NAMES);
        expect(new Set(shown).size).toBe(shown.length);
        getOSBehavior('fenrir_v1'); // the registry fills on first use
        const registryNames = new Set(Object.values(FIRMWARE_REGISTRY).map((def) => def.name));
        for (const key of Object.keys(NORSE_INSTINCT_NAMES)) {
            expect(registryNames.has(key), `${key} is a registry name`).toBe(true);
        }
    });

    it('looks a name up, and says nothing for one that is not a species Instinct', () => {
        expect(norseInstinctName('CINDER_WALL_OS')).toBe('Muspel Wall');
        expect(norseInstinctName('SHORT_CIRCUIT')).toBeUndefined();
        expect(norseInstinctName('toString')).toBeUndefined();
    });

    it('carries into a sentence, where the log and the rules text print the old name', () => {
        expect(plain('CINDER_WALL_OS feeds on Burn.')).toBe('Muspel Wall feeds on Burn.');
        expect(plain("Hraesvelgr's UPDRAFT_KERNEL increases Max Energy by 1!")).toBe("Hraesvelgr's Stormrise increases Max Energy by 1!");
    });

    it('leaves a Rune or an Aura to the old re-casing', () => {
        expect(instinctName('SHORT_CIRCUIT')).toBe('Short Circuit');
        expect(instinctName('HOOFBEAT_DAEMON+')).toBe('Hoofbeat Aura+');
    });
});
