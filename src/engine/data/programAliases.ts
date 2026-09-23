/**
 * TICKET 162a — the thirteen ids collection v2 renamed, and what they now mean.
 *
 * # WHY AN ALIAS TABLE AND NOT A FIND-AND-REPLACE
 *
 * `water_slap` is named in ~90 scenario fixtures under `src/debug/scenarios`, in twenty non-EA
 * species' decks, in the balance corpus's saved snapshots and in the run logs Henry has on disk
 * from previous playtests. Those are RECORDS. Rewriting a record to match a rename makes the
 * record a lie about what was played, and a snapshot whose ids were rewritten no longer replays
 * the fight it captured.
 *
 * So the rename is resolved at the door instead: one card, one canonical id, and every old
 * spelling still opens it.
 *
 * # WHY THE ALIASES ARE NOT KEYS IN `ProgramRegistry`
 *
 * Aliasing by writing `ProgramRegistry[oldId] = ProgramRegistry[newId]` was the shorter fix and it
 * is wrong: eight places walk `Object.keys(ProgramRegistry)` — the codex, the card browser, the
 * scenario composer, the registry hash, `EncounterGenerator`'s pools — and every one of them would
 * see each renamed card twice. The card browser would list two Tackles; the reward pool would
 * offer one at double weight; `registryHash` would change for a rename that changed no card.
 *
 * The table is therefore consulted by `GetProgramData` and by the handful of call sites that index
 * the registry directly, and the registry itself holds exactly one entry per card.
 *
 * # THE RULE FOR ADDING TO IT
 *
 * An entry belongs here when a card KEPT ITS IDENTITY and changed its id. `fire_poke -> ember_jab`
 * qualifies: same card, new name, new numbers. A card that was DELETED does not get an alias
 * pointing at whatever replaced it — that would make a scenario silently replay a different card
 * and call it a reproduction. Deleted is deleted; `programs-v1.json` is where it went.
 */
export const PROGRAM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
    // v1 id                     // collection v2 id
    cinder_armor_daemon: 'cinder_armor',
    core_overclock_daemon: 'core_overclock',
    echo_chamber_v2: 'echo_chamber',
    feedback_loop_daemon: 'feedback_loop',
    fire_poke: 'ember_jab',
    healing_mist: 'tend',
    hoofbeat_daemon: 'hoofbeat',
    seed_bomb_v2: 'seed_bomb',
    seed_spit: 'acorn_toss',
    squirrel_away: 'deep_scan',
    tidal_wave_v2: 'tidal_wave',
    water_slap: 'tackle',
    whirlpool_v2: 'whirlpool',
});

/**
 * The canonical id for `id`. Returns `id` unchanged when it is already canonical or unknown —
 * "unknown" is `GetProgramData`'s problem to report, not this function's to guess at.
 *
 * Deliberately NOT transitive. A chain (`a -> b -> c`) would mean an alias outlived a second
 * rename, and resolving it silently is how a fixture ends up pointing three cards away from what
 * it recorded. One hop, or it is a new entry in the table.
 */
export function resolveProgramId(id: string): string {
    return PROGRAM_ALIASES[id] ?? id;
}
