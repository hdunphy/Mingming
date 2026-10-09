/**
 * TICKET 195e-2 — the names and lines that sounded like computers, before the Norse pass
 * (research/195-norse-flavour-names.md). A sweep that renders a screen, an event or a data file fails if one of
 * these is still printed. It lists the names a player would have read at the time (after `plain()`, so "Amber
 * Cache" and "Draught Crate" as well as the raw "Scrap Cache" and "Macro Crate"). Ids are not names: `free_exec`,
 * `driver_static_haze` and `capacitor` keep their spelling and are not matched (a word boundary and a space or
 * capital shape are required).
 */
export const OLD_FLAVOUR_NAMES = new RegExp(
    '\\b(?:' + [
        // Events
        '(?:Amber|Scrap) Cache', 'Abandoned Terminal', 'Data Fragments', 'Relay Tower', 'Corrupted Stream', 'Rare Vault',
        '(?:Draught|Macro) Crate', 'Overclock Rig', 'Data Broker', 'Mirror Protocol', 'Black-Market (?:Rune|Patch)',
        'Corrupted Cache', 'Instinct Retrain', 'Firmware Reflash', 'Recompiler',
        // Draughts
        'Free Exec', 'Cache Pull', 'Ping Sweep', 'Recharge',
        // Totems and event debuffs
        'Frayed Signal', 'Static Haze', 'Bulwark Reflex', 'Deep Cache', 'Static Field', 'Overkill Recovery',
        // Cards
        'Corrupted Data', 'Scavenge Data', 'Deep Scan', 'Capacitor', 'Discharge', 'Tidal Battery', 'Surge Protection',
        // Modifier line
        'Marketplace and (?:workshop|den)',
    ].join('|') + ')\\b',
    'gi',
);
