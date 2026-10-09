/**
 * TICKET 183i — THE NORSE INSTINCT NAMES. Henry (2026-10-03, "Instinct renames are good, accept all"):
 * the 33 species Instincts are shown under Norse names. The key is the registry's own name (what
 * `getOSBehavior(id).name` says); the value is what the player reads. Ids, saves and the registry keep
 * the old names, so no save and no balance run moves.
 *
 * Four were already fine and keep their name (Unbound, Abyssal Ink, Tidal Crush, Treachery). They are
 * listed anyway so the table is the whole roster and a test can pin it.
 *
 * Only `instinctName()` in `labels.ts` reads this. Anything not listed here is still re-cased by the old rules.
 */
export const NORSE_INSTINCT_NAMES: Readonly<Record<string, string>> = {
    // species instinct id -> registry name : shown name
    UNBOUND_KERNEL: "Unbound",              // fenrir_v1 (kept)
    CINDER_WALL_OS: "Muspel Wall",          // fenrir_v2
    ABYSSAL_INK_SYS: "Abyssal Ink",         // kraken_v1 (kept)
    TIDAL_CRUSH_OS: "Tidal Crush",          // kraken_v2 (kept)
    HOARD_PROTOCOL: "Dragon's Hoard",       // fafnir_v1
    CORRUPTED_GOLD_OS: "Andvari's Curse",   // fafnir_v2
    TREACHERY_KERNEL: "Treachery",          // skoll_v1 (kept)
    EMBER_FUSE: "Sunscorch",                // skoll_v2
    OUROBOROS_LOOP: "Midgard Coil",         // jormungandr_v1
    TOXIN_FANG_OS: "Venomfang",             // jormungandr_v2
    UNSTOPPABLE_MASS: "Golden Bristles",    // gullinbursti_v1
    KINETIC_RAM_OS: "Tuskrush",             // gullinbursti_v2
    GALE_FORCE_OS: "Eagle's Gust",          // hraesvelgr_v1
    UPDRAFT_KERNEL: "Stormrise",            // hraesvelgr_v2
    MOMENTUM_DRIVE: "Eightfold Stride",     // sleipnir_v1
    WAR_STEED_OS: "Odin's Charge",          // sleipnir_v2
    GOSSIP_NODE: "Branch Gossip",           // ratatoskr_v1
    INSTIGATOR_OS: "Tale-Bearer",           // ratatoskr_v2
    ALLURE_PROXY: "Glamour",                // huldra_v1
    BARK_SHIELD_OS: "Elderwood Ward",       // huldra_v2
    GLACIER_HEART_SYS: "Rimeheart",         // ymir_v1
    GLACIAL_PACE_OS: "Jötun Patience",      // ymir_v2
    PERMAFROST_WAKE: "Restless Dead",       // draugr_v1
    GRAVE_CHILL_OS: "Barrow Chill",         // draugr_v2
    VALHALLA_UPLINK: "Valhalla's Call",     // valkyrie_v1
    REBIRTH_CYCLE_OS: "Folkvangr Dawn",     // valkyrie_v2
    GENESIS_FIRMWARE: "Ginnungagap",        // audhumbla_v1
    PRIMORDIAL_MILK: "Elder Milk",          // audhumbla_v2
    NULL_FIRMWARE: "Unmarked",              // control_v1
    TWILIGHT_CADENCE: "Twin Faces",         // hel_v1
    UNDERWORLD_GATEWAY: "Helgrind",         // hel_v2
    ROOT_CORRUPTION: "Rootgnaw",            // nidhoggr_v1
    BLOOD_SCENT_OS: "Carrion Hunger",       // nidhoggr_v2
};

/**
 * TICKET 192 — THE NORSE AURA NAMES. Henry (2026-10-03, "Accept all including the feedback token").
 * An Aura (a "Daemon" card) is named in two places: the card's own `name` in `programs.json`, which now
 * says the Norse name outright, and the name of its entry in `hooks.json`, which stays in capitals and
 * underscores because the log texts and the walker's output quote it. This table is the second place:
 * the key is the hooks.json name, the value is what the player reads. A "+" card keeps its plus.
 * Three keep their name (Einherjar Standard, Riptide, Hoofbeat); they are listed so the table is whole.
 * Runes need no table: `patchRegistry.ts` carries their Norse names directly.
 */
export const NORSE_AURA_NAMES: Readonly<Record<string, string>> = {
    DEFENSIVE_DAEMON: "Dwarf-Forged", // harden_daemon
    "DEFENSIVE_DAEMON+": "Dwarf-Forged+",
    FERTILE_GROUND: "Norns' Gift",    // fertile_ground_daemon
    "FERTILE_GROUND+": "Norns' Gift+",
    SHORT_CIRCUIT: "Wisdom's Price",  // short_circuit
    "SHORT_CIRCUIT+": "Wisdom's Price+",
    REACTIVE_PLATING: "Berserkergang", // reactive_plating
    "REACTIVE_PLATING+": "Berserkergang+",
    SCRUBBER: "Eir's Remedy",         // scrubber
    "SCRUBBER+": "Eir's Remedy+",
    DRIP_FEED: "Idunn's Apples",      // drip_feed
    "DRIP_FEED+": "Idunn's Apples+",
    OVERCLOCK_CORE: "Well of Mimir",  // overclock_core
    "OVERCLOCK_CORE+": "Well of Mimir+",
    SHORT_FUSE: "Hoarder's Toll",     // short_fuse
    "SHORT_FUSE+": "Hoarder's Toll+",
    STATIC_WARD: "Frigg's Oath",      // static_ward
    "STATIC_WARD+": "Frigg's Oath+",
    CORE_OVERCLOCK: "Megingjord",     // core_overclock
    "CORE_OVERCLOCK+": "Megingjord+",
    CINDER_ARMOR: "Emberhide",        // cinder_armor
    "CINDER_ARMOR+": "Emberhide+",
    EMBER_WARD: "Brynhild's Ring",    // ember_ward
    "EMBER_WARD+": "Brynhild's Ring+",
    SINDRIS_FORGE: "Sindri's Forge",  // sindris_forge (ticket 207)
    FEEDBACK_LOOP: "Huginn's Dive",   // feedback_loop
    "FEEDBACK_LOOP+": "Huginn's Dive+",
    ECHO_CHAMBER_DAEMON: "Gjallarhorn", // echo_chamber
    "ECHO_CHAMBER_DAEMON+": "Gjallarhorn+",
    THERMAL_OVERLOAD: "Surtr's Fever", // thermal_overload
    "THERMAL_OVERLOAD+": "Surtr's Fever+",
    EINHERJAR_STANDARD: "Einherjar Standard", // einherjar_standard
    "EINHERJAR_STANDARD+": "Einherjar Standard+",
    RIPTIDE: "Riptide",               // riptide
    "RIPTIDE+": "Riptide+",
    HOOFBEAT_DAEMON: "Hoofbeat",      // hoofbeat
    "HOOFBEAT_DAEMON+": "Hoofbeat+",
};

/** The Norse name for a registry name (a species Instinct, or an Aura's hooks.json name), or undefined when there is none. */
export function norseInstinctName(registryName: string): string | undefined {
    if (Object.prototype.hasOwnProperty.call(NORSE_INSTINCT_NAMES, registryName)) return NORSE_INSTINCT_NAMES[registryName];
    if (Object.prototype.hasOwnProperty.call(NORSE_AURA_NAMES, registryName)) return NORSE_AURA_NAMES[registryName];
    return undefined;
}
