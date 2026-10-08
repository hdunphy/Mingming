/**
 * TICKET 195e-2 — the Norse flavour names Henry approved on 2026-10-07
 * (research/195-norse-flavour-names.md, with his three changes: Einherjar Feast, Forge Slag, Urðarbrunnr).
 *
 * The tables below are the approved list written out by hand, so a stray edit to `events.json`,
 * `macroRegistry.ts`, `hooks.json`, `programs.json` or `modifiers.json` fails here. Ids never change: every
 * table is keyed by the id, and the name or line is what a player reads (after `plain()`, as the screens print it).
 */
import { describe, expect, it } from 'vitest';

import { describeDriver } from '../../engine/data/driverRegistry';
import hooks from '../../engine/data/lib/hooks.json';
import { MacroRegistry } from '../../engine/data/macroRegistry';
import modifiersRaw from '../../engine/data/modifiers.json';
import { GetProgramData, ProgramRegistry } from '../../engine/data/programRegistry';
import programsRaw from '../../engine/data/programs.json';
import { choiceDetail } from '../../engine/run/events/eventDetail';
import { EVENTS, getEvent } from '../../engine/run/events/eventCatalogue';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import { plain } from './labels';
import { OLD_FLAVOUR_NAMES } from '../../debug/oldFlavourNames';

/** Section 1: event id -> name, line. (The five marked + in the list are included; Henry took all of them.) */
const EVENT_NAMES: ReadonlyArray<readonly [string, string, string]> = [
    ['scrap_cache', 'Barrow Gold', 'A barrow, half-opened. The gold inside still gleams.'],
    ['abandoned_terminal', "The Norns' Loom", 'A loom hung with glowing thread. It will rework one card.'],
    ['data_fragments', 'Scattered Verses', 'Half-remembered verses drift on the wind.'],
    ['wild_tracks', 'Wild Tracks', 'Fresh paw-prints lead off the path.'],
    ['relay_tower', "Heimdall's Watch", "A watchman's post, half-buried. Its horn can still be sounded once."],
    ['corrupted_stream', 'Gjöll Ford', 'The path runs through a black, churning river. It will cost you to cross.'],
    ['rare_vault', "Dragon's Barrow", 'A sealed barrow. The seal is already broken.'],
    ['macro_crate', "Brewer's Cask", 'A cask of single-use draughts, sealed with wax.'],
    ['trader', 'Trader', 'A hooded peddler offers to swap. They only trade up.'],
    ['overclock_rig', "Brokk's Forge", "A dwarf's forge. It works, mostly."],
    ['data_broker', "The Skald's Price", 'A skald who sells verses by the line. He has a price list.'],
    ['stray_mingming', 'Stray Mingming', 'A lost Mingming is following your trail.'],
    ['ambush_bait', 'Ambush Bait', 'Something is nesting in the ruins, guarding a hoard.'],
    ['mirror_protocol', "Loki's Mirror", 'A shapeshifter\'s pool that copies whatever it is shown. It charges by the job.'],
    ['driver_shrine', 'Totem Shrine', 'An old Totem, still warm, cradled in a mossy shrine. It wants an offering.'],
    ['black_market_patch', 'The Runecarver', 'A rune-carver, no questions asked.'],
    ['corrupted_cache', 'Cursed Hoard', 'A hoard wrapped in a curse. Maybe it\'s fine.'],
    ['the_toll', 'The Toll', 'A troll blocks the path. It wants payment.'],
    ['firmware_reflash', 'Well of Urd', 'A still pool beneath the roots. One body can be remade.'],
    ['recompiler', 'Seiðr Cauldron', 'A cauldron on the boil. What goes in is not what comes out.'],
];

describe('195e-2 section 1 — events', () => {
    it('lists the twenty events, none dropped', () => {
        expect(EVENTS.map((e) => e.id).sort()).toEqual(EVENT_NAMES.map(([id]) => id).sort());
    });

    it.each(EVENT_NAMES)('%s is named %s and reads its new line', (id, name, line) => {
        const event = getEvent(id);
        expect(plain(event?.name)).toBe(name);
        expect(plain(event?.text)).toBe(line);
    });

    it('the Relay Tower\'s second option is "Plunder it", and it still gives 20 amber', () => {
        const strip = getEvent('relay_tower')?.choices.find((c) => c.id === 'strip');
        expect(strip?.label).toBe('Plunder it');
        expect(plain(strip?.detail)).toBe('+20 amber');
    });

    it('the options that name a game word keep it (Retrain, Fit, Pick 1 of 3)', () => {
        expect(plain(getEvent('firmware_reflash')?.choices[0].label)).toBe('Retrain one body');
        expect(plain(getEvent('black_market_patch')?.choices[0].detail)).toBe('Fit the best rune to one body.');
        expect(getEvent('data_fragments')?.choices[0].label).toBe('Pick 1 of 3 cards');
    });

    it('the lines that name a card or a debuff use the new name', () => {
        expect(plain(getEvent('overclock_rig')?.choices[0].detail)).toBe('Free. Forge Slag is added to your deck.');
        expect(plain(getEvent('corrupted_cache')?.choices[0].detail)).toBe('50%: pick 1 of 3 Rare cards. 50%: Forge Slag and -15 amber.');
        expect(plain(choiceDetail(getEvent('scrap_cache')!.choices.find((c) => c.id === 'dig')!))).toMatch(/^\+50 amber\. Barrow Mist next fight: /);
        expect(plain(choiceDetail(getEvent('corrupted_stream')!.choices.find((c) => c.id === 'push')!))).toMatch(/^Gjöll Chill next fight: /);
    });
});

/** Section 2: Draught id -> name, description (the descriptions are unchanged). */
const DRAUGHTS: ReadonlyArray<readonly [string, string, string]> = [
    ['free_exec', 'Swift Hand', 'The next card this unit plays this turn costs nothing.'],
    ['cache_pull', "Raven's Draw", 'Draw 2 cards.'],
    ['ping_sweep', "Heimdall's Gaze", 'Shows which Mingmings wait in every fight in the biome you are standing in. Fires from the map.'],
    ['recharge', 'Second Wind', 'Gives one unit +1 Energy right now.'],
    // Kept
    ['echo', 'Echo', 'Replays the last card you played, free, at a target you choose.'],
    ['surge', 'Surge', 'A burst of damage at one enemy.'],
];

describe('195e-2 section 2 — Draughts', () => {
    it.each(DRAUGHTS)('%s is %s', (id, name, description) => {
        expect(MacroRegistry[id].name).toBe(name);
        expect(MacroRegistry[id].description).toBe(description);
    });
});

/** Sections 3 and 4: Totem id -> name, rule text (the rule texts are unchanged). */
const TOTEMS: ReadonlyArray<readonly [string, string, string]> = [
    ['driver_frayed_signal', 'GJÖLL CHILL', 'At the start of your first turn, each member loses 25% of its max HP.'],
    ['driver_static_haze', 'BARROW MIST', 'At the start of your first turn, each member gains 2 Weakened.'],
    ['driver_bulwark_reflex', 'SHIELDWALL', 'The first time each member drops below 50% HP in a fight, it gains 15 Bark Shield.'],
    ['driver_deep_cache', "RAVEN'S BOON", 'The first bonus (non-natural) draw this side makes each turn grants the drawer 1 Strengthened.'],
    ['driver_static_field', 'STORMSPARK', 'Every card this side plays deals 6 power to a random enemy.'],
    ['driver_overkill_recovery', 'EINHERJAR FEAST', 'Whenever an enemy faints, every living member of this side heals 8% of max HP.'],
    // Kept
    ['driver_first_blood', 'FIRST BLOOD', ''],
    ['driver_tenth_strike', 'TENTH STRIKE', ''],
    ['driver_antivenom', 'ANTIVENOM', ''],
    ['driver_root_rot', 'ROOT ROT', ''],
    ['driver_war_footing', 'WAR FOOTING', ''],
    ['driver_tidal_surge', 'TIDAL SURGE', ''],
];

describe('195e-2 sections 3 and 4 — event debuffs and Totems', () => {
    it.each(TOTEMS)('%s is %s', (id, name, rule) => {
        const driver = describeDriver(id);
        expect(driver.name).toBe(name);
        if (rule !== '') expect(driver.description).toBe(rule);
    });

    it('the Totem names survive plain() unchanged, as the screens print them', () => {
        for (const [, name] of TOTEMS) expect(plain(name)).toBe(name);
    });
});

/** Section 4b: the six battle-log lines that go with the Totems, as hooks.json holds them. */
const LOG_LINES: ReadonlyArray<readonly [string, string]> = [
    ['driver_deep_cache', "🪶 RAVEN'S BOON: {target} is Strengthened."],
    ['driver_static_field', "⚡ STORMSPARK leaps from {owner}'s card."],
    ['driver_overkill_recovery', '💚 EINHERJAR FEAST: {owner} recovers.'],
    ['driver_bulwark_reflex', '🪵 SHIELDWALL: {owner} braces behind bark.'],
    ['driver_frayed_signal', 'GJÖLL CHILL: {owner} loses a quarter of its HP to the icy ford.'],
    ['driver_static_haze', "BARROW MIST: the mist saps {owner}'s strength."],
];

function textsOf(node: unknown, into: string[] = []): string[] {
    if (Array.isArray(node)) node.forEach((n) => textsOf(n, into));
    else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (key === 'text' && typeof value === 'string') into.push(value);
            else textsOf(value, into);
        }
    }
    return into;
}

describe('195e-2 section 4b — the Totems\' battle-log lines', () => {
    it.each(LOG_LINES)('%s logs %s', (id, line) => {
        const texts = textsOf((hooks as unknown as Record<string, unknown>)[id]);
        expect(texts).toEqual([line]);
    });
});

/** Section 5: card id -> name, cost, element, text. The numbers are the ones the cards already had. */
const CARDS: ReadonlyArray<readonly [string, string, number, string, string]> = [
    ['corrupted_data', 'Forge Slag', 1, 'None', 'Does nothing. Exhaust.'],
    ['scavenge_data', "Fisher's Haul", 1, 'Water', 'Draw a Water card.'],
    ['deep_scan', "Völva's Sight", 1, 'None', 'Draw 2.'],
    ['capacitor', 'Warhorn', 2, 'None', 'Gain 3 Energized.'],
    ['discharge', 'Thunderclap', 1, 'None', 'Remove up to 4 Strengthened from the target. Apply 1 Burn per 2 removed.'],
    ['tidal_battery', "Ægir's Feast", 2, 'Water', 'Every ally gains 1 Energized.'],
    ['surge_protection', 'Urðarbrunnr', 1, 'Water', '25 power. If an effect drew your team a card this turn, refund 1 Energy.'],
];

/** The upgraded cards' text, which is also unchanged. */
const UPGRADED: ReadonlyArray<readonly [string, string, string]> = [
    ['deep_scan+', "Völva's Sight+", 'Draw 3.'],
    ['capacitor+', 'Warhorn+', 'Gain 4 Energized.'],
    ['scavenge_data+', "Fisher's Haul+", 'Draw 2 Water cards.'],
    ['tidal_battery+', "Ægir's Feast+", 'Every ally gains 2 Energized.'],
    ['surge_protection+', 'Urðarbrunnr+', '35 power. If an effect drew your team a card this turn, refund 1 Energy.'],
];

describe('195e-2 section 5 — cards', () => {
    it.each(CARDS)('%s is %s (cost %i, %s)', (id, name, cost, element, text) => {
        const card = GetProgramData(id);
        expect(card.name).toBe(name);
        expect(card.baseCost).toBe(cost);
        expect(card.element).toBe(element);
        expect(card.description).toBe(text);
    });

    it.each(UPGRADED)('the "+" card %s keeps the plus: %s', (id, name, text) => {
        expect(GetProgramData(id).name).toBe(name);
        expect(GetProgramData(id).description).toBe(text);
    });

    it('Discharge and the junk card have no upgrade, so no "+" name exists for them', () => {
        expect(ProgramRegistry['discharge+']).toBeUndefined();
        expect(ProgramRegistry['corrupted_data+']).toBeUndefined();
    });

    it('no two cards share a name (the list was checked against the registry)', () => {
        const names = Object.values(programsRaw as unknown as Record<string, { name: string }>).map((c) => c.name);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        expect(dupes).toEqual([]);
    });
});

describe('195e-2 section 6 — modifiers', () => {
    const byId = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));

    it('Junk Start reads exactly "Start with two Forge Slag in your deck."', () => {
        expect(byId.junk_start.description).toBe('Start with two Forge Slag in your deck.');
    });

    it('Tight Budget reads "Shop and den prices +25%."', () => {
        expect(plain(byId.tight_budget.description)).toBe('Shop and den prices +25%.');
    });
});

describe('195e-2 — the old names are in no player-visible string', () => {
    /** Every string of a data file a player can read: names, lines, rule texts, labels, details. */
    function strings(node: unknown, into: string[] = []): string[] {
        if (typeof node === 'string') into.push(node);
        else if (Array.isArray(node)) node.forEach((n) => strings(n, into));
        else if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
                if (key === 'id' || key === 'driverId' || key === 'upgradeOf') continue;
                strings(value, into);
            }
        }
        return into;
    }
    const oldIn = (list: string[]): string[] => list.map((s) => plain(s)).filter((s) => { OLD_FLAVOUR_NAMES.lastIndex = 0; return OLD_FLAVOUR_NAMES.test(s); });

    it('events.json', () => {
        expect(oldIn(EVENTS.flatMap((e) => strings(e)))).toEqual([]);
    });

    it('the Draughts', () => {
        expect(oldIn(Object.values(MacroRegistry).flatMap((m) => [m.name, m.description]))).toEqual([]);
    });

    it('every hooks.json name, rule text and log line', () => {
        const rows = Object.values(hooks as unknown as Record<string, { name?: string; description?: string }>);
        const named = rows.flatMap((h) => [h.name ?? '', h.description ?? '']);
        expect(oldIn([...named, ...textsOf(hooks)])).toEqual([]);
    });

    it('every card name and rule text', () => {
        const cards = Object.values(programsRaw as unknown as Record<string, { name: string; description?: string }>);
        expect(oldIn(cards.flatMap((c) => [c.name, c.description ?? '']))).toEqual([]);
    });

    it('the modifiers', () => {
        expect(oldIn(strings(modifiersRaw))).toEqual([]);
    });

    it('the old-name pattern does catch what it should', () => {
        for (const old of ['Amber Cache', 'Frayed Signal', 'Surge Protection', 'Start with 2 Corrupted Data', 'Free Exec']) {
            OLD_FLAVOUR_NAMES.lastIndex = 0;
            expect(OLD_FLAVOUR_NAMES.test(old), old).toBe(true);
        }
    });
});
