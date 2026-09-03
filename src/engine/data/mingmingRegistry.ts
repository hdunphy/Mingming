import type { IMingmingDefinition } from "../types";

export const MingmingRegistry: Record<string, IMingmingDefinition> = {
    "fenrir": {
        id: "fenrir",
        name: "Fenrir",
        baseStats: {
            hp: 66,
            attack: 91,
            defense: 69,
            energy: 2
        },
        primaryElement: "Fire",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["fenrir_v1", "fenrir_v2"],
        // Ticket 04: the designed deck belongs to the v2 slot (CINDER_WALL_OS); the other slot
        // holds a copy until its own deck lands (kraken first, ticket 14).
        decks: {
            "fenrir_v1": ["ember_mend", "blood_rite", "blood_rite", "berserk_rush", "berserk_rush", "battle_rhythm", "crimson_draw", "ragnarok_edge", "ragnarok_edge"],
            "fenrir_v2": ["ignite", "ignite", "molten_core", "molten_core", "slag_strike", "water_slap", "pyre_sacrifice", "ash_communion", "cinder_lance"]
        },
        /*
         * THE FIVE-CARD ENGINE — ticket 61's amended spec (Henry, 2026-08-26, ratified table).
         *
         * A start kit is **the signature payoff plus four enablers**. The STARTER adds three
         * generics on top for an 8-card opening deck; a mid-run RECRUIT brings its bare five. This
         * replaces ticket 09's table, and the replacement inverts its central choice.
         *
         * Ticket 09 deliberately WITHHELD the payoff — "leaves the `ragnarok_edge` finishers to be
         * earned back", "keeps `echo_chamber_v2` over the `seed_bomb_v2` payoff" — on the reasoning
         * that a run should build toward its own deck. Round 5 measured what that felt like:
         * *"ratatoskr's startKit carried none of his engine, making him pure feed."* A kit with the
         * enablers and no payoff is not a weak engine, it is a pile of setup for a card the player
         * may never draw, and it reads as a species that does not work.
         *
         * So the payoff is in, and it leads the list. Five tags: the deck-size arithmetic is
         * **8 / 13 / 18** by party size, which is also the active deck's FLOOR — see
         * `createRun.minimumActiveDeck`. An engine of four was tried in between (ticket 60's
         * "mini-engine 6") and Henry cut it: four tagged cards was too thin to play a species with.
         */
        startKits: {
            // v1: the finisher, and the consume cycle that pays for it.
            "fenrir_v1": ["ragnarok_edge", "blood_rite", "berserk_rush", "battle_rhythm", "crimson_draw"],
            // v2: the Burn payoff over its own ignition. `ignite` x2 because one is a coin flip.
            "fenrir_v2": ["pyre_sacrifice", "ignite", "ignite", "molten_core", "slag_strike"]
        },
        moves: [
            {
                id: 'fenrir_bite',
                name: 'Savage Bite',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 15, element: 'Fire', target: 'Single' }]
            },
            {
                id: 'fenrir_howl',
                name: 'Intimidating Howl',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Weakened', stacks: 2, target: 'Side' }]
            },
            {
                id: 'fenrir_pounce',
                name: 'Pounce',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 10, element: 'None', target: 'Single' }, { type: 'STATUS', status: 'Strengthened', stacks: 1, target: 'Self' }] // Self buff
            }
        ],
        artReference: "Fenrir.png"
    },
    "kraken": {
        id: "kraken",
        name: "Kraken",
        // Ticket 70: attack 80 -> 100. Henry picked the lane ("Kraken needs to pick a lane and
        // with low HP and Def it's not working"); the sweep picked ATTACK over HP and DEF. HP is
        // nearly inert here - +24 HP bought 6.5 points of field and removed no zero matchups -
        // and DEF buys field but WIDENS the band problem (13 violations at def111 vs 10 here).
        // Attack is the only lane that kills the outright losses: 14 zero-win-rate matchups
        // across v1 and v2 fall to 6, and v1's NEUTRAL zeros go to none. Confirmed on two seed
        // bases. Deliberately NOT 104/105, which buy 1-2 more points of field by converting low
        // violations into HIGH ones - the ticket-69 standard counts both ends.
        baseStats: {
            hp: 58,
            attack: 100,
            defense: 87,
            energy: 2
        },
        primaryElement: "Water",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["kraken_v1", "kraken_v2"],
        // Ticket 14 (pilot, Henry-approved 2026-08-05): real per-OS decks.
        // v1 ABYSSAL_INK - draw engine (4 draw cards feed the ink) with ink_stream as the clock.
        // Ticket 71: `water_slap` -> `undertow`. Once `ink_stream` counted only TRIGGERED draws,
        // v1's "engine" was four CONDITIONAL one-card draws and measured 0.92 triggered draws a
        // cast against jormungandr_v1's 1.75 - so the same card paid v1 8.1 damage and jormungandr
        // 17.1. `undertow` is the 0e unconditional Water draw jormungandr_v1 already runs; it costs
        // the same as the `water_slap` filler it replaces and is what makes the OS payoff real.
        // v2 TIDAL_CRUSH - ramp into 3e Water payoffs (maelstrom is new; capacitor fixed to 2e).
        // Ticket 136g: the deck was 29 and the OS was doing nothing, because a 30% boost on
        // Water cards costing 2+ needs cards worth boosting. capacitor now pays 3 Energized
        // and no Sharp (nothing in the deck scaled off Sharp), and the two surge_protections
        // and two water_slaps became boiling_surge x2 and scald x2 - a Burn setup the boosted
        // hammers then cash. Burn caps at 4, so the two feeds fill it and stop.
        decks: {
            "kraken_v1": ["whirlpool_v2", "whirlpool_v2", "pressure_point", "pressure_point", "ink_stream", "ink_stream", "crushing_depths", "undertow"],
            "kraken_v2": ["maelstrom", "hydro_blast", "capacitor", "capacitor", "boiling_surge", "boiling_surge", "scald", "scald"]
        },
        startKits: {
            // v1: the draw payoff over the cards that fill the pile it counts.
            "kraken_v1": ["ink_stream", "undertow", "whirlpool_v2", "pressure_point", "pressure_point"],
            // v2: the 3e payoff, the ramp that reaches it, the mitigation that survives to cash it.
            "kraken_v2": ["hydro_blast", "capacitor", "capacitor", "boiling_surge", "boiling_surge"]
        },
        moves: [
            {
                id: 'kraken_tentacle',
                name: 'Tentacle Slap',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 12, element: 'Water', target: 'Single' }]
            },
            {
                id: 'kraken_ink',
                name: 'Ink Cloud',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Dazed', stacks: 2, target: 'Side' }]
            },
            {
                id: 'kraken_crush',
                name: 'Crushing Grip',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 8, element: 'None', target: 'Single' }, { type: 'STATUS', status: 'Stunned', stacks: 1, target: 'Single' }]
            },
            {
                id: 'kraken_regen',
                name: 'Deep Regeneration',
                intentType: 'Buff',
                priority: 3,
                actions: [{ type: 'HEAL', power: 20, target: 'Self' }, { type: 'STATUS', status: 'Regen', stacks: 2, target: 'Self' }]
            }
        ],
        artReference: "Kraken.png"
    },
    "fafnir": {
        id: "fafnir",
        name: "Fafnir",
        baseStats: {
            hp: 92,
            attack: 68,
            defense: 95,
            energy: 3
        },
        primaryElement: "Earth",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["fafnir_v1", "fafnir_v2"],
        // Ticket 52 (Henry's design): EARTH COMPLETES, and the split finally resolves the HIGH
        // fafnir/gullinbursti overlap flag open since ticket 08 - both ran the same Sharp package.
        // Fafnir keeps NO Sharp at all; gullinbursti keeps all of it.
        //
        // The frame is what the whole element turns on: fafnir's attack/defense is 0.74, so the
        // same card deals 47% LESS damage here than on nidhoggr and his effective pool is 498
        // power - the largest in the roster by 44%. On-curve Earth cards are worth about half
        // what the curve thinks in a mirror, which is why gullinbursti stalled at 61 turns on a
        // deck whose every card scored in band.
        // v1 HOARD_PROTOCOL - bank energy 1:1 against an HP tax, then dump it into `deep_vein`.
        //    The ratio is unchanged: 2:1 compounds (2 -> 4 -> 8 -> 16 by turn four against a
        //    linearly growing tax) and 1:1 is the only stable one. What was missing was never
        //    the rate, it was something to cash into. FOUR 0-costs, deliberately: a draw card
        //    costs the exact resource a hoard deck is banking, so the AI would have to choose
        //    between acting and banking. It does not have to now.
        // v2 CORRUPTED_GOLD_OS - self-inflicted Poison feeds the OS. Poison, not Weakened, is
        //    the point: Poison has no duality partner, so the Strengthened accrues on top of it
        //    instead of annihilating against it.
        decks: {
            "fafnir_v1": ["iron_will", "iron_will", "water_slap", "grit", "boulder_smash", "boulder_smash", "motherlode", "motherlode", "hoardbreaker", "deep_vein", "deep_vein"],
            "fafnir_v2": ["iron_will", "iron_will", "water_slap", "rust_blood", "rust_blood", "boulder_smash", "boulder_smash", "squirrel_away", "veinburst", "veinburst"]
        },
        moves: [
            {
                id: 'fafnir_smash',
                name: 'Golden Smash',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 18, element: 'Earth', target: 'Single' }]
            },
            {
                id: 'fafnir_glare',
                name: 'Greed Glare',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Weakened', stacks: 2, target: 'Single' }]
            }
        ],
        artReference: "Fafnir.svg"
    },
    "skoll": {
        id: "skoll",
        name: "Skoll",
        baseStats: {
            hp: 70,
            attack: 95,
            defense: 55,
            energy: 2
        },
        primaryElement: "Fire",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["skoll_v1", "skoll_v2"],
        // Ticket 64: ONE resource, TWO appetites. v1 EATS her Strength, v2 HOARDS it - the
        // species identity that replaces the ticket-13 legacy shared lists both slots ran until
        // now. `adrenaline` (57.8% dead) and `core_overclock_daemon` (42.5% dead, its 8-cap
        // overfed in 57.5% of games) both leave; both stay in the registry.
        decks: {
            // TREACHERY consume-cycle: get hit, grow the pile, DEVOUR it. `crimson_draw`
            // extends the feeding window by keeping her alive inside her own drawback.
            "skoll_v1": ["sun_devourer", "sun_devourer", "fury_strike", "fury_strike", "brute_force", "battle_rhythm", "crimson_draw", "crimson_draw", "water_slap"],
            // Solar ignition: `strength_burst` lights the core, `overdrive`/`glass_cannon` nuke
            // under +75%. `all_in`'s 3 self-Burn is the first card in the game that expresses
            // symmetric detonation risk - at cap 4 it sits one stray stack from blowing up on
            // her. No sustain by design; the clock is built in.
            // Knob round 1 (ticket 64, pre-authorized): `strength_burst` x2 -> x1 + `fury_strike`.
            // The 2-copy list read 40.5% dead against a 0.35 gate - four 2-cost cards on a
            // 2-Energy frame in a 3.5-turn game is a curve problem, not a power one, and the
            // second copy is the one that rots. `fury_strike` at 1e feeds the same pile.
            // Amendment 1 (ticket 64, Henry): `overdrive` x2 -> x1, `fury_strike` x1 -> x2 -
            // the curve swap that closes the dead-card gate the ship left RED (36.9/38.2 vs
            // 0.35). Three 2-cost cards on a 2-Energy frame was the diagnosis; this removes the
            // third. `fury_strike` is the only 1e attack that FEEDS the OS (+1 Str = +15% on
            // every subsequent hit), so the lost nuke copy partially returns as fuel.
            "skoll_v2": ["strength_burst", "fury_strike", "fury_strike", "all_in", "desperate_strike", "reckless_charge", "overdrive", "glass_cannon", "water_slap"]
        },
        // Ticket 09 (Henry ratified 2026-08-21): the five cards a run STARTS with, per ticket 08.
        // Both kits keep `fury_strike` x2 because it is the 1e card that FEEDS each OS, and a
        // single copy on a 3.5-turn clock is a card the run may never see.
        // v1 keeps one `sun_devourer` as the consume payoff; v2 keeps `strength_burst` to light
        // the core and `glass_cannon` to cash it, leaving `all_in`'s self-Burn risk to be drafted.
        startKits: {
            "skoll_v1": ["sun_devourer", "fury_strike", "fury_strike", "brute_force", "battle_rhythm"],
            "skoll_v2": ["overdrive", "fury_strike", "fury_strike", "strength_burst", "reckless_charge"]
        },
        moves: [
            {
                id: 'skoll_bite',
                name: 'Sun Chaser Bite',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 16, element: 'Fire', target: 'Single' }]
            },
            {
                id: 'skoll_howl',
                name: 'Solar Flare',
                intentType: 'Attack',
                priority: 7,
                actions: [{ type: 'ATTACK', power: 12, element: 'Fire', target: 'Side' }]
            }
        ],
        artReference: "Skoll.svg"
    },
    "jormungandr": {
        id: "jormungandr",
        name: "Jormungandr",
        baseStats: {
            hp: 110,
            attack: 75,
            defense: 75,
            energy: 2
        },
        primaryElement: "Water",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["jormungandr_v1", "jormungandr_v2"],
        // Ticket 55 + amendment 1 (deep pass #1). v1 OUROBOROS is a DRAW-ZOO, and the chain is
        // bounded in FIRMWARE, not here: OUROBOROS_LOOP procs at most ONCE PER TURN. That is
        // deliberate and it is the whole reason the cantrips can sit at 2 copies - players build
        // from the shared pool, so a curated deck list can never contain the chain, and only a
        // firmware cap is pool-proof. The deck feeds it cantrips (`undertow` x2, `tide_reading`)
        // so the 3rd-Water-card proc reliably fires once, and it carries TWO payoffs that read
        // different
        // counters - `serpents_coil` on cards PLAYED, `ink_stream` on cards DRAWN. Still
        // all-Water by necessity: the loop counts Water cards only, so a None-tier card here
        // would be a hole in the engine.
        // v2 is TOXIN_FANG_OS, a poison-BRUISER rather than the old VENOM_TRENCH attrition
        // plan: attacks deal +2 per Poison stack on the target, so the pile is an amplifier
        // that gets cashed the same turn. `capacitor` left (its economy argument died with the
        // 2-Energy world; the card stays in the registry as a ramp draft pick) and `contagion`
        // stayed, because doubling the pile now doubles the amplifier immediately.
        decks: {
            "jormungandr_v1": ["undertow", "undertow", "blind_spot", "corrosive_leak", "surge_protection", "serpents_coil", "serpents_coil", "ink_stream", "ink_stream"],
            "jormungandr_v2": ["corrosive_bolt", "corrosive_bolt", "venom_fang", "venom_fang", "water_slap", "water_slap", "toxic_surge", "contagion"]
        },
        // Ticket 09 (Henry ratified 2026-08-21): the five cards a run STARTS with, per ticket 08.
        // v1 keeps `undertow` x2 - the loop counts Water cards drawn, so the draw half has to
        // arrive doubled or `ink_stream` is a dead clock - plus one counter from each side.
        // v2 keeps the amplifier pair whole (`corrosive_bolt` x2, `venom_fang` x2) and one
        // payoff; `contagion` doubles a pile that does not exist yet at run start.
        startKits: {
            "jormungandr_v1": ["ink_stream", "undertow", "undertow", "serpents_coil", "blind_spot"],
            "jormungandr_v2": ["contagion", "corrosive_bolt", "corrosive_bolt", "toxic_surge", "venom_fang"]
        },
        moves: [
            {
                id: 'jorm_constrict',
                name: 'Abyssal Constrict',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 14, element: 'Water', target: 'Single' }, { type: 'STATUS', status: 'Stunned', stacks: 1, target: 'Single' }]
            },
            {
                id: 'jorm_venom',
                name: 'World-Drowning Venom',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Poison', stacks: 5, target: 'Single' }]
            }
        ],
        artReference: "Jormungandr.svg"
    },
    "gullinbursti": {
        id: "gullinbursti",
        name: "Gullinbursti",
        baseStats: {
            hp: 85,
            attack: 70,
            defense: 90,
            energy: 2
        },
        primaryElement: "Earth",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["gullinbursti_v1", "gullinbursti_v2"],
        // Ticket 52: gullinbursti keeps the whole Sharp package (see fafnir's note - the two
        // species ran the same deck until now, the map's one HIGH overlap risk since ticket 08).
        // v1 UNSTOPPABLE_MASS - prime with a status card, spike with one big Attack. The charge
        //    pays +20 POWER now rather than a cost reduction: the discount was worth a full
        //    Energy point every turn (~40 power, ~240 a game) and stacked with any other cost
        //    reduction, which is the arbitrage seam ticket 36 documented.
        // v2 KINETIC_RAM - Sharp x hits. The bonus is 0.5 per raw stack, not 1: it is
        //    `onDamageCalculated`, so it lands on EVERY hit of a multi-hit card, and the raw
        //    Sharp count is uncapped where Sharp's own effect caps at 12.5. Henry's call was to
        //    change the rate, not add a ceiling.
        decks: {
            "gullinbursti_v1": ["water_slap", "keen_edge", "keen_edge", "shield_shards", "shield_shards", "stone_bark", "stone_fist", "stone_fist", "motherlode", "spiked_carapace"],
            "gullinbursti_v2": ["water_slap", "water_slap", "keen_edge", "keen_edge", "shield_shards", "shield_shards", "stone_flurry", "stone_flurry", "crag_barrage", "crag_barrage"]
        },
        moves: [
            {
                id: 'gullin_charge',
                name: 'Golden Charge',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 20, element: 'Earth', target: 'Single' }]
            },
            {
                id: 'gullin_glow',
                name: 'Radiant Bristles',
                intentType: 'Buff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Sharp', stacks: 2, target: 'Self' }]
            }
        ],
        artReference: "Gullinbursti.svg"
    },
    "hraesvelgr": {
        id: "hraesvelgr",
        name: "Hraesvelgr",
        baseStats: {
            hp: 70,
            attack: 85,
            defense: 65,
            energy: 2
        },
        primaryElement: "Air",
        secondaryElement: "None",
        cardDraw: 5,
        availableOS: ["hraesvelgr_v1", "hraesvelgr_v2"],
        // Ticket 22 (Air, second half): v1 GALE_FORCE_OS = the discard WINDMILL - every
        // voluntary discard is 10 Air damage, so Tempest and the discardEffect cards are
        // the engine and Carrion Swoop is the payoff. v2 UPDRAFT_KERNEL = burn-X ramp -
        // cycle the deck for +1 max Energy, then cash it through the X-cost cards.
        decks: {
            "hraesvelgr_v1": ["feather_cache", "feather_cache", "war_molt", "war_molt", "sky_burial", "sky_burial", "tempest", "tempest", "carrion_swoop", "carrion_swoop", "zephyr_strike", "slipstream"],
            "hraesvelgr_v2": ["sun_eaters_plunge", "thermal_lance", "firestorm_talon", "cinder_gust", "cinder_gust", "tailwind", "slipstream", "zephyr_strike"]
        },
        moves: [
            {
                id: 'hraes_flap',
                name: 'Corpse-Swallowing Gust',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 12, element: 'Air', target: 'Side' }]
            },
            {
                id: 'hraes_dive',
                name: 'Gale Dive',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 22, element: 'Air', target: 'Single' }]
            }
        ],
        artReference: "Hraesvelgr.svg"
    },
    "sleipnir": {
        id: "sleipnir",
        name: "Sleipnir",
        baseStats: {
            hp: 75,
            attack: 90,
            defense: 70,
            energy: 2
        },
        primaryElement: "Air",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["sleipnir_v1", "sleipnir_v2"],
        // Ticket 21 (Air first pass): v1 MOMENTUM_DRIVE = zoo momentum - five 0-cost cards
        // feed the Strengthened engine, Stampede/Trample cash it. v2 WAR_STEED_OS = discard-cost
        // cavalry - the OS's free Hoof Strike tokens become the fodder Lance/Cavalry Charge spend.
        decks: {
            "sleipnir_v1": ["water_slap", "water_slap", "slipstream", "slipstream", "disorienting_gust", "adrenaline", "tailwind", "zephyr_strike", "stampede", "stampede", "momentum_crash", "hoofbeat_daemon"],
            "sleipnir_v2": ["lance", "lance", "cavalry_charge", "zephyr_strike", "zephyr_strike", "dust_devil", "war_molt", "water_slap"]
        },
        moves: [
            {
                id: 'sleipnir_kick',
                name: 'Eight-Legged Strike',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 8, element: 'Air', target: 'Single' }, { type: 'ATTACK', power: 8, element: 'Air', target: 'Single' }]
            },
            {
                id: 'sleipnir_gallop',
                name: 'Wind Gallop',
                intentType: 'Buff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Energized', stacks: 2, target: 'Self' }]
            }
        ],
        artReference: "Sleipnir.svg"
    },
    "ratatoskr": {
        id: "ratatoskr",
        name: "Ratatoskr",
        baseStats: {
            hp: 62,
            attack: 55,
            defense: 63,
            energy: 2
        },
        primaryElement: "Nature",
        secondaryElement: "None",
        cardDraw: 5,
        availableOS: ["ratatoskr_v1", "ratatoskr_v2"],
        // Ticket 04: the designed deck belongs to the v1 slot (GOSSIP_NODE); the other slot
        // holds a copy until its own deck lands (kraken first, ticket 14).
        // Ticket 32 (Henry's design): real per-OS decks. Ratatoskr is attack 55 - the lowest
        // frame in the roster. Ticket 136d took his third Energy back - at 3 Energy he ran
        // 75/78 against the field - so cardDraw 5 is the whole offset now, and both decks
        // still win on card VOLUME, never on a multiplied single hit. That is also what
        // separates him from sleipnir_v1, which runs the same 0-cost fuel into a raw-Strength
        // multiplier.
        // v1 GOSSIP_NODE - card spam. Five 0-costs, each of which echo_chamber turns into a
        //    Feedback token that re-triggers the OS (the daemon excludes tokens, the OS does
        //    not), so every real 0-cost is worth two procs. seed_bomb x2 is the payoff.
        // v2 INSTIGATOR_OS - Dazed stacking. Same fuel, opposite payoff: slander reads the
        //    target's RAW Dazed stacks and so ignores the +-25% cap the OS would otherwise
        //    pay into.
        // Ticket 47: v1 traded squirrel_away for shrug_off. The two firmwares pay out at the
        //    SAME rate - one HP or one Dazed per 0-cost play - and one of those is worth far
        //    more, so v2 took the head-to-head 80/20 while the decks sat five points apart
        //    against the field. v1 was the only deck in the roster with no answer to a status
        //    clock at all. A FULL cleanse is a switch here (0.21 -> 0.65+); a partial shed is
        //    the dial. It replaces the 1e draw rather than the heal because a 1e utility card
        //    is strictly worse than the same effect at 0e in this deck - it costs the whole
        //    turn's Energy AND skips both the echo_chamber token and the OS proc.
        decks: {
            "ratatoskr_v1": ["forage", "forage", "water_slap", "water_slap", "healing_mist", "shrug_off", "nettle_sting", "nettle_sting", "seed_bomb_v2", "seed_bomb_v2", "echo_chamber_v2"],
            "ratatoskr_v2": ["pollen_cloud", "pollen_cloud", "water_slap", "water_slap", "nagging_bite", "nagging_bite", "crippling_vine", "slander", "echo_chamber_v2"]
        },
        // Ticket 09 (Henry ratified 2026-08-21): the five cards a run STARTS with, per ticket 08.
        // Both kits lead with the 0-cost fuel doubled, because these decks win on card VOLUME
        // and a single copy of the fuel starves the OS proc that the whole species is built on.
        // v1 keeps `echo_chamber_v2` (each 0-cost is then worth two procs) over the `seed_bomb_v2`
        // payoff; v2 keeps `crippling_vine` and leaves `slander` to be drafted onto a real pile.
        startKits: {
            // THE DECK THAT PROVED THE RULE. Round 5: "ratatoskr's startKit carried none of his
            // engine (seed_bomb/echo were untagged), making him pure feed." Both are tagged now.
            "ratatoskr_v1": ["seed_bomb_v2", "forage", "forage", "echo_chamber_v2", "healing_mist"],
            "ratatoskr_v2": ["crippling_vine", "pollen_cloud", "pollen_cloud", "nagging_bite", "nagging_bite"]
        },
        moves: [
            {
                id: 'rata_nut',
                name: 'Acorn Throw',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 8, element: 'Nature', target: 'Single' }, { type: 'ATTACK', power: 8, element: 'Nature', target: 'Single' }]
            },
            {
                id: 'rata_gossip',
                name: 'Malicious Gossip',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Poison', stacks: 3, target: 'Single' }, { type: 'STATUS', status: 'Poison', stacks: 3, target: 'Single' }]
            },
            {
                id: 'rata_scurry',
                name: 'Scurry',
                intentType: 'Buff',
                priority: 3,
                actions: [{ type: 'STATUS', status: 'Energized', stacks: 2, target: 'Self' }]
            }
        ],
        artReference: "Ratatoskr.png"
    },
    "huldra": {
        id: "huldra",
        name: "Huldra",
        baseStats: {
            hp: 80,
            attack: 75,
            defense: 80,
            energy: 2
        },
        primaryElement: "Nature",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["huldra_v1", "huldra_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        // Ticket 33 (Henry's design): real per-OS decks. Nature completes at 16/32.
        // v1 ALLURE_PROXY - N2 buff-mirror hex. Every status she puts on her own side mirrors
        //    1 Weakened onto a random enemy, so the deck debuffs for free and hexbloom cashes
        //    the pile as Poison. thorn_tithe's SELF-Weakened is deliberate: the hook has no
        //    positive-status filter and ALLY includes self, so a self-debuff mirrors too.
        //    DELIBERATELY the weakest deck in the roster and team-leaning - see the ticket.
        // v2 BARK_SHIELD_OS - H1 shield wall on a Poison clock. Distinct from jormungandr_v2's
        //    poison attrition at the payoff level because a shield DECAYS and a heal does not:
        //    she is the fast poison deck that must win inside the shield's life, where jorm's
        //    2 HP/turn trickle rewards the opposite. heartwood earns its slot on shield UPTIME
        //    (keeping thornguard's conditional live), not on mitigation - a 1e budget buys 7%
        //    maxHP against an OS that grants 50%.
        decks: {
            "huldra_v1": ["growth", "growth", "soothe", "water_slap", "iron_bark", "iron_bark", "thorn_tithe", "thorn_tithe", "hexbloom"],
            "huldra_v2": ["sap_vigor", "sap_vigor", "water_slap", "nettle_sting", "nettle_sting", "heartwood", "thornguard", "thornguard", "blightbloom"]
        },
        // Ticket 09 (Henry ratified 2026-08-21): the five cards a run STARTS with, per ticket 08.
        // v1 keeps `growth` x2 so the mirror hook has statuses to mirror from turn one, plus
        // `thorn_tithe` and `hexbloom` to cash the pile - the buff half without the payoff is
        // the weakest opening in the roster and this deck is already the weakest deck.
        // v2 keeps the shield wall whole (`sap_vigor` x2, `thornguard` x2) and `heartwood`,
        // which earns its slot on shield UPTIME rather than on mitigation.
        startKits: {
            "huldra_v1": ["hexbloom", "growth", "growth", "iron_bark", "thorn_tithe"],
            "huldra_v2": ["blightbloom", "sap_vigor", "thornguard", "thornguard", "heartwood"]
        },
        moves: [
            {
                id: 'huld_charm',
                name: 'Siren Song',
                intentType: 'Debuff',
                priority: 10,
                actions: [{ type: 'STATUS', status: 'Asleep', stacks: 1, target: 'Single' }]
            },
            {
                id: 'huld_slash',
                name: 'Toxic Root',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 15, element: 'Nature', target: 'Single' }, { type: 'STATUS', status: 'Poison', stacks: 2, target: 'Single' }]
            }
        ],
        artReference: "Huldra.svg"
    },
    "ymir": {
        id: "ymir",
        name: "Ymir",
        baseStats: {
            hp: 120,
            attack: 95,
            defense: 85,
            energy: 2
        },
        primaryElement: "Ice",
        secondaryElement: "None",
        // Ticket 50: 2 -> 3. At draw 2 the hand size WAS the constraint GLACIAL_PACE's
        // maxCardsPerTurn was supposed to be, so "play what you drew" was the only line.
        // At 3 it becomes "pick 2 of 3" - card pressure, not an energy trade (see §5).
        cardDraw: 4,
        availableOS: ["ymir_v1", "ymir_v2"],
        // Ticket 50 (Henry's design): ICE COMPLETES. Ymir was never weak - it was unkillable
        // and could not kill, a 60-turn mirror at 72/400 decided.
        // v1 GLACIER_HEART_SYS - the wall IS the weapon. 5 BarkShield at TURN START (not end:
        //    a shield granted at end of turn is eaten before he acts, and `avalanche` would read
        //    zero), self-capping at 5x the grant through the 20%/turn decay. `avalanche` casts
        //    the standing pile off as damage without consuming it.
        // v2 GLACIAL_PACE - two big cards a turn. NO 0-cost cards, and no neutral tier at all:
        //    a None-element card gets neither STAB nor the Ice bonus, so it is worth ~40% less
        //    here than the same card in Ice. Deliberate deviation from the ticket-04 three-tier
        //    rulebook, same shape as draugr_v2.
        decks: {
            "ymir_v1": ["frost_ward", "frost_ward", "rimeguard", "rimeguard", "thaw", "ice_spear", "ice_spear", "avalanche", "avalanche", "flash_freeze"],
            "ymir_v2": ["bracing_cold", "bracing_cold", "thaw", "ice_spear", "ice_spear", "numbing_gale", "numbing_gale", "glacial_maul", "glacial_maul", "glacial_slam"]
        },
        moves: [
            {
                id: 'ymir_smash',
                name: 'Glacial Crush',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 25, element: 'Ice', target: 'Single' }]
            },
            {
                id: 'ymir_freeze',
                name: 'Absolute Zero',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Stunned', stacks: 1, target: 'Side' }]
            }
        ],
        artReference: "Ymir.svg"
    },
    "draugr": {
        id: "draugr",
        name: "Draugr",
        baseStats: {
            hp: 90,
            attack: 85,
            defense: 75,
            energy: 3
        },
        primaryElement: "Ice",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["draugr_v1", "draugr_v2"],
        // Ticket 48 (Henry's design): Draugr sleeps ON PURPOSE.
        // v1 PERMAFROST_WAKE - `actsWhileAsleep` turns Asleep from a lost turn into a STANCE he
        //    pays a card to enter, and the payoff cards read "+N power if you are Asleep". The
        //    enemy takes the stance away by hitting him (Asleep now loses a stack per incoming
        //    attack), and the wake pays 1 Energized and a card. That makes a two-turn rhythm:
        //    a SLEEP turn on 2 energy (grave_rest -> nightmare, 100 power) and an AWAKE turn on
        //    3 where StableOS blocks re-sleeping and barrow_king lands - the only 3-cost in Ice,
        //    castable only because the wake banks the energy.
        // v2 GRAVE_CHILL_OS - unrelated, and unchanged since ticket 12: enemies carrying 2+
        //    DISTINCT debuffs deal 20% less to Draugr. Fed with cheap variety and cashed by
        //    rimebreaker, which scales on the same distinct count - so the firmware and the win
        //    condition want the identical board.
        decks: {
            "draugr_v1": ["grave_rest", "grave_rest", "barrow_rot", "deathless_slumber", "dread_tidings", "dread_tidings", "glacier_wall", "ice_spear", "nightmare", "nightmare", "barrow_king"],
            "draugr_v2": ["rimefrost", "rimefrost", "water_slap", "frost_bite", "numbing_gale", "killing_frost", "ice_spear", "glacial_slam", "rimebreaker", "rimebreaker"]
        },
        moves: [
            {
                id: 'draugr_slash',
                name: 'Spectral Blade',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 18, element: 'Ice', target: 'Single' }]
            },
            {
                id: 'draugr_chill',
                name: 'Grave Chill',
                intentType: 'Debuff',
                priority: 6,
                actions: [{ type: 'STATUS', status: 'Weakened', stacks: 2, target: 'Single' }]
            }
        ],
        artReference: "Draugr.svg"
    },
    "valkyrie": {
        id: "valkyrie",
        name: "Valkyrie",
        baseStats: {
            hp: 85,
            attack: 85,
            defense: 80,
            energy: 2
        },
        primaryElement: "Light",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["valkyrie_v1", "valkyrie_v2"],
        // Ticket 53 (Light pass). v1 is EINHERJAR RECURSION: VALHALLA_UPLINK replays a random
        // discarded card every turn end, so the deck wants cheap cards worth replaying and two
        // RAMPAGE `zealots_edge` that grow on the free cast as well as the paid one.
        // v2 is RADIANT CYCLE: REBIRTH_CYCLE_OS pays out on every reshuffle, so the deck is
        // deliberately EIGHT cards and three of them exhaust - it thins 8 -> 5 and reshuffles
        // roughly every other turn. `starfall` cashes the draw the thin deck produces.
        decks: {
            "valkyrie_v1": ["pale_mercy", "benediction", "benediction", "zealots_edge", "zealots_edge", "echo_of_valhalla", "ascension", "radiant_spark", "smite", "healing_light"],
            "valkyrie_v2": ["falling_star", "falling_star", "morning_light", "starfall", "starfall", "ascension", "radiant_spark", "glimmer"]
        },
        moves: [
            {
                id: 'valkyrie_smite',
                name: 'Radiant Smite',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 14, element: 'Light', target: 'Single' }]
            },
            {
                id: 'valkyrie_mark',
                name: 'Death Mark',
                intentType: 'Debuff',
                priority: 6,
                actions: [{ type: 'STATUS', status: 'Dazed', stacks: 2, target: 'Single' }]
            },
            {
                id: 'valkyrie_trance',
                name: 'Battle Trance',
                intentType: 'Buff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Strengthened', stacks: 1, target: 'Self' }, { type: 'STATUS', status: 'Sharp', stacks: 1, target: 'Self' }]
            },
            {
                id: 'valkyrie_spear',
                name: 'Spear of Dawn',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 20, element: 'Light', target: 'Single' }]
            }
        ],
        artReference: "Valkyrie.svg"
    },
    "audhumbla": {
        id: "audhumbla",
        name: "Audhumbla",
        baseStats: {
            hp: 100,
            attack: 75,
            defense: 90,
            // Ticket 53: 3 -> 2. GENESIS_FIRMWARE now hands out permanent max Energy from turn
            // one or two, so starting at 3 meant the ramp's first two ticks bought nothing she
            // could not already do. At 2 the 3-cost card is the ramp's literal unlock.
            energy: 2
        },
        primaryElement: "Light",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["audhumbla_v1", "audhumbla_v2"],
        // Ticket 53 (Light pass). v1 is GENESIS RAMP: GENESIS_FIRMWARE converts an OVERHEAL into
        // a permanent +1 max Energy (once per turn), so the deck deliberately overheals early -
        // `pale_mercy` x2 at full HP is the ramp's on-switch - and `genesis_surge` (X-cost,
        // 15 x X^2) is what the ramp is FOR. Her base Energy dropped 3 -> 2 in the same pass so
        // the 3-cost `dawn_of_creation` is a card the ramp unlocks rather than an opener.
        // v2 is NOURISH CANNON: 25% of ALL healing is mirrored as Light damage, so every heal
        // is an attack and the deck is nothing but heals and cheap Light.
        decks: {
            "audhumbla_v1": ["pale_mercy", "pale_mercy", "dawnstrike", "healing_light", "sacred_spring", "supernova_v2", "genesis_surge", "dawn_of_creation", "radiant_spark"],
            "audhumbla_v2": ["pale_mercy", "healing_light", "sacred_spring", "morning_dew", "drink_deep", "smite", "radiant_spark", "dawnstrike", "dawnstrike"]
        },
        moves: [
            {
                id: 'audhumbla_lick',
                name: 'Mending Lick',
                intentType: 'Buff',
                priority: 10,
                actions: [{ type: 'HEAL', power: 15, target: 'Single' }]
            },
            {
                id: 'audhumbla_milk',
                name: 'Primordial Milk',
                intentType: 'Buff',
                priority: 6,
                actions: [{ type: 'HEAL', power: 10, target: 'Side' }, { type: 'STATUS', status: 'Regen', stacks: 1, target: 'Side' }]
            },
            {
                id: 'audhumbla_bolster',
                name: 'Stalwart Aegis',
                intentType: 'Buff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Energized', stacks: 1, target: 'Side' }, { type: 'STATUS', status: 'StableOS', stacks: 1, target: 'Self' }]
            },
            {
                id: 'audhumbla_slam',
                name: 'Horn Toss',
                intentType: 'Attack',
                priority: 4,
                actions: [{ type: 'ATTACK', power: 12, element: 'None', target: 'Single' }]
            }
        ],
        artReference: "Audhumbla.svg"
    },
    // ---------------------------------------------------------------------------
    // Ticket 42: THE CONTROL. Not a playable Mingming - a measuring instrument.
    //
    // Every gate we had measures a DIFFERENCE. Section 2.3 is same-species, so it reports the
    // gap between two firmwares and is blind to where both sit; the mirror is a species against
    // itself. The archetype gauntlet does compare across species, but its benchmark was kraken -
    // a real, elemental, tuned deck that itself sits well below the field, so the yardstick both
    // skewed and DRIFTED with every kraken retune. That is how nidhoggr reached a 94% field
    // average while passing its own section 2.3.
    //
    // This deck fixes the yardstick:
    //  - Element None. `None: {}` in ElementalMatrix and no element has a None entry, so it is
    //    elementally inert in BOTH directions - no STAB, no advantage, no resistance. Every
    //    species meets it on identical terms, which removes the largest confound in a round
    //    robin (measured: the Fire decks beat poison decks by +57 points on the matrix alone).
    //  - No firmware (NULL_FIRMWARE, hooks: []).
    //  - Median frame: 82/85/78 across the 16 species, rounded to 80/85/80 on the 5s rule.
    //  - Every card priced EXACTLY at its band ceiling - 1.0 / 3.0 / 6.5.
    //
    // That last point is what makes it useful: the control IS the power curve made playable, so
    // a win rate against it reads directly as "how far above its printed cost does this deck
    // actually perform" - which is the one thing powerscale cannot see, because deck synergy,
    // firmware and sequencing never appear in a per-card static score.
    //
    // DO NOT TUNE THIS DECK. Its whole value is that it never moves. It is excluded from
    // BALANCE_SPECIES (mirror and section 2.3) and is only ever the gauntlet benchmark.
    // ---------------------------------------------------------------------------
    "control": {
        id: "control",
        name: "Control",
        isControl: true,
        // CALIBRATED, and the calibration is itself the headline measurement. On the MEDIAN
        // species frame (82/85/78) this deck - on-curve cards, no firmware - lost 97.9% of 1600
        // games against the whole registry. Every real deck is roughly two tiers above what its
        // own cards are priced at, because a deck's power is cards PLUS firmware PLUS synergy
        // and the curve only prices the first. The gap measured here is what the other two are
        // worth: +37% HP and +24% attack over the median frame to reach the roster's midpoint.
        //
        // Ticket 45 (Henry): RE-TARGETED TO ~25%, not the median. The control is meant to be the
        // FLOOR - the worst deck in the game - not the midpoint, so "what beats the control" is a
        // low bar every real deck should clear and the interesting reading is by how much.
        // Measured across all 16 species: 110/105/95 -> 33.0%, 105/100/95 -> 26.9%,
        // 105/100/90 -> 17.4%, 90/90/85 -> 3.3%. DEFENSE is the dominant stat here - 90 -> 95 is
        // worth ~14 points on its own, far more than HP.
        baseStats: {
            hp: 105,
            attack: 100,
            defense: 95,
            energy: 2
        },
        primaryElement: "None",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["control_v1"],
        decks: {
            "control_v1": ["baseline_jab", "baseline_jab", "baseline_scuff", "baseline_scuff", "baseline_strike", "baseline_strike", "baseline_snare", "baseline_snare", "baseline_slam", "baseline_purge"]
        },
        moves: [
            {
                id: 'control_jab',
                name: 'Jab',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 10, element: 'None', target: 'Single' }]
            },
            {
                id: 'control_slam',
                name: 'Slam',
                intentType: 'Attack',
                priority: 6,
                actions: [{ type: 'ATTACK', power: 65, element: 'None', target: 'Single' }]
            }
        ],
        artReference: "Control.svg"
    },
    "hel": {
        id: "hel",
        name: "Hel",
        baseStats: {
            hp: 80,
            attack: 95,
            defense: 60,
            energy: 2
        },
        primaryElement: "Dark",
        // Ticket 36: the roster's first dual-type Mingming, and the first secondaryElement
        // that is not "None". getModifierBreakdown already reads secondaryElement for STAB,
        // so her Light cards hit at 1.5x with no further work. Do NOT add a Light: 1.0 entry
        // to ElementalMatrix to "balance" it - absent means neutral there; an explicit 1.0
        // gets multiplied by SECONDARY_MITIGATION and becomes a silent 25% penalty.
        secondaryElement: "Light",
        cardDraw: 5,
        availableOS: ["hel_v1", "hel_v2"],
        // Ticket 36 (Henry's design): Hel is the roster's first dual-type Mingming (Dark/Light).
        // Ticket 78: v1's `purify` -> a second `eclipse`. Purify was PROVEN unnecessary, not
        // guessed at: it played at a 6.3% rate and essentially at random (93 casts into decks
        // that apply Poison or Burn against 102 into decks that apply neither), and she scores
        // BETTER against DoT decks without it. Of the legal replacements - the rulebook caps
        // copies at 2, so a third `nights_bite` was never shippable - a second `eclipse` measured
        // best at 46.7% field against dawnstrike 42.5%, lumen_surge 36.4%, hamstring 34.7% and
        // keeping purify 31.4%. Eclipse is her best card by damage per Energy (9.4, 1.5x her
        // next), so the deck now runs two of them.
        // v1 TWILIGHT_CADENCE - the element she casts sets her stance at end of action, so the
        //    card that sets a stance never benefits from it, only the next one. Dark = +30%
        //    dealt, Light = -30% taken. None-element cards set NO stance, which makes Tackle
        //    and hamstring the only way to act without committing. eclipse cashes the brace.
        // v2 UNDERWORLD_GATEWAY - her cards cost no Energy at all; each one drains 5% maxHP per
        //    point of its PRINTED cost instead, so she is the only Mingming who casts 3e freely
        //    (soul_tithe) and her own hand is her clock (~24 HP on a full hand). Healing is
        //    boosted 1.5x at the OS so the heal cards stay on-curve.
        decks: {
            "hel_v1": ["shadow_claw", "shadow_claw", "pale_mercy", "pale_mercy", "water_slap", "nights_bite", "nights_bite", "eclipse", "lumen_surge", "hamstring", "eclipse"],
            "hel_v2": ["pale_mercy", "pale_mercy", "forage", "forage", "dawnstrike", "dawnstrike", "venom_shade", "soul_tithe", "squirrel_away", "last_rites"]
        },
        moves: [
            {
                id: 'hel_touch',
                name: 'Cold Embrace',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 12, element: 'Dark', target: 'Single' }]
            },
            {
                id: 'hel_grasp',
                name: 'Grasp of Helheim',
                intentType: 'Attack',
                priority: 8,
                actions: [{ type: 'ATTACK', power: 22, element: 'Dark', target: 'Single' }, { type: 'ATTACK', power: 6, element: 'None', target: 'Self' }] // Recoil to host
            },
            {
                id: 'hel_reaping',
                name: 'Soul Reaping',
                intentType: 'Attack',
                priority: 6,
                actions: [{ type: 'ATTACK', power: 18, element: 'Dark', target: 'Single' }, { type: 'STATUS', status: 'Weakened', stacks: 1, target: 'Self' }] // Self-debuff cost
            }
        ],
        artReference: "Hel.svg"
    },
    "nidhoggr": {
        id: "nidhoggr",
        name: "Nidhoggr",
        baseStats: {
            hp: 105,
            attack: 100,
            defense: 68,
            energy: 2
        },
        primaryElement: "Dark",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["nidhoggr_v1", "nidhoggr_v2"],
        // Ticket 39 (Henry's design): Dark completes here.
        // v1 ROOT_CORRUPTION - poison stops decaying at 2+ stacks, so it is a permanent RATE
        //    rather than a decaying burst, and the deck's question every turn is hold or cash.
        //    wither_feast is the cash-in: it triggers the poison three times, then eats it.
        // v2 BLOOD_SCENT - anything crossing below half HP pays him 1 Energy and a card, so he
        //    opens the window himself (leech_strike) and swings rend_marrow into it at +87.5%.
        //    Nothing else in the roster reads the ENEMY's health bar.
        //    Tuned (knob 7): leech_strike went to 2e and night_terror came out for water_slap -
        //    that swap is what crossed the band. umbral_feast consumes HIS OWN Poison, which in
        //    the gate matchup is mostly the pile v1 put there: it was eating v1's win condition
        //    for ~33 HP a cast, which is why blight_bloom trades Poison AWAY for raw power.
        decks: {
            "nidhoggr_v1": ["rot_seed", "rot_seed", "shadow_claw", "water_slap", "venom_shade", "venom_shade", "curse_mark", "blight_bloom", "blight_bloom", "wither_feast"],
            "nidhoggr_v2": ["shadow_claw", "shadow_claw", "bloodletting", "bloodletting", "leech_strike", "leech_strike", "umbral_feast", "water_slap", "rend_marrow", "rend_marrow"]
        },
        moves: [
            {
                id: 'nidhoggr_gnaw',
                name: 'Root Gnaw',
                intentType: 'Attack',
                priority: 10,
                actions: [{ type: 'ATTACK', power: 14, element: 'Dark', target: 'Single' }, { type: 'STATUS', status: 'Poison', stacks: 3, target: 'Single' }]
            },
            {
                id: 'nidhoggr_feast',
                name: 'Feast of Malice',
                intentType: 'Attack',
                priority: 7,
                actions: [
                    { type: 'ATTACK', power: 12, element: 'Dark', target: 'Single' },
                    // Bonus hit that only lands on poisoned targets (per-hit conditional)
                    { type: 'ATTACK', power: 10, element: 'Dark', target: 'Single', conditionals: [{ type: 'HAS_STATUS', target: 'TARGET', value: 'Poison' }] }
                ]
            },
            {
                id: 'nidhoggr_venom',
                name: 'Corpse Venom',
                intentType: 'Debuff',
                priority: 6,
                actions: [{ type: 'STATUS', status: 'Poison', stacks: 3, target: 'Side' }]
            },
            {
                id: 'nidhoggr_dread',
                name: 'Creeping Dread',
                intentType: 'Debuff',
                priority: 5,
                actions: [{ type: 'STATUS', status: 'Weakened', stacks: 2, target: 'Single' }, { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'Single' }]
            }
        ],
        artReference: "Nidhoggr.svg"
    }
}




export const GetMingmingData = (id: string): IMingmingDefinition => {
    const data = MingmingRegistry[id];
    if (!data) {
        console.warn(`Mingming ID not found: ${id}`);
        return {
            id: 'missing',
            name: 'Missing Mingming',
            baseStats: {
                hp: 1,
                attack: 1,
                defense: 1,
                energy: 1
            },
            primaryElement: 'None',
            secondaryElement: 'None',
            // Deliberately NOT bumped with the roster in ticket 131b. This is the not-found
            // sentinel, not a mingming - it exists so a bad id renders a hollow unit instead of
            // throwing, and "buffing" it would only make a bug harder to spot.
            cardDraw: 1,
            availableOS: [],
            decks: {},
            artReference: ''
        };
    }
    return data;
};


/**
 * Ticket 42: the PLAYABLE roster - every registry entry except measuring instruments.
 *
 * `MingmingRegistry` is the unit-definition lookup and the balance control lives in it because
 * the harness resolves stats and decks through it. Anything player-facing - encounters, the
 * roster count, drop pools - must enumerate through here instead, or the control shows up as a
 * wild Mingming.
 */
export const PLAYABLE_SPECIES: ReadonlyArray<string> =
    Object.keys(MingmingRegistry).filter(id => !MingmingRegistry[id].isControl);

/**
 * Ticket 05: the Early Access roster - 6 species / 12 decks, two each of Fire, Water and
 * Nature. Three elements taken in pairs is a PURE counter cycle: every species has something
 * it beats and something that beats it, with no odd element sitting outside the triangle.
 *
 * The other ten species stay in `MingmingRegistry` because the balance harness and the deck
 * passes need them; they are simply not what ships. Anything scoped to launch - `startKits`
 * coverage, the EA content audit - must enumerate through here. This constant lived only in
 * the ticket-05 doc until now, which is why every consumer was hand-listing the six ids.
 */
export const LAUNCH_SPECIES: ReadonlyArray<string> = ['fenrir', 'skoll', 'kraken', 'jormungandr', 'ratatoskr', 'huldra'];

/**
 * Ticket 09: the generic filler card ticket 08 left unnamed - the 3 cards a member and the
 * 1 a recruit bring alongside their `startKit`.
 *
 * It is `water_slap` and not a new `basic_strike` because `water_slap` already IS the card
 * ticket 08 describes: element 'None' (so no species gains STAB from it), named "Tackle",
 * 0-cost, 12 power, with a description that states the design out loud - "A plain, reliable
 * hit. Neutral programs gain no STAB - priced at 12 power to compensate." It is already the
 * filler in 9 of the 12 launch decks, so players meet it as the generic either way.
 *
 * Minting a new card would duplicate a shipped one AND add a `ProgramRegistry` entry, which
 * moves `registryHash` and invalidates every stored battle snapshot in `playtest-results/`.
 * Reuse beats churn: the id is misleading, but a rename is a separate, cheaper ticket.
 */
export const GENERIC_HIT = 'water_slap';

/**
 * Ticket 13: per-OS starting decks. Resolves a species' deck for a firmware id,
 * defaulting to `availableOS[0]` — the same rule `initializeBattleEntity` uses
 * for a missing activeOS — and falling back to an empty list for unknown species.
 */
export const getDeckForOS = (definitionId: string, osId?: string): string[] => {
    const def = GetMingmingData(definitionId);
    const primary = def.availableOS[0];
    const key = osId && def.decks[osId] ? osId : primary;
    return def.decks[key] ? [...def.decks[key]] : [];
};
