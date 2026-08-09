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
        cardDraw: 3,
        availableOS: ["fenrir_v1", "fenrir_v2"],
        // Ticket 04: the designed deck belongs to the v2 slot (CINDER_WALL_OS); the other slot
        // holds a copy until its own deck lands (kraken first, ticket 14).
        decks: {
            "fenrir_v1": ["ember_mend", "blood_rite", "blood_rite", "berserk_rush", "berserk_rush", "battle_rhythm", "crimson_draw", "ragnarok_edge", "ragnarok_edge"],
            "fenrir_v2": ["ignite", "ignite", "molten_core", "molten_core", "slag_strike", "water_slap", "pyre_sacrifice", "ash_communion", "cinder_lance"]
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
        baseStats: {
            hp: 58,
            attack: 80,
            defense: 87,
            energy: 2
        },
        primaryElement: "Water",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["kraken_v1", "kraken_v2"],
        // Ticket 14 (pilot, Henry-approved 2026-08-05): real per-OS decks.
        // v1 ABYSSAL_INK - draw engine (4 draw cards feed the ink) with ink_stream as the clock.
        // v2 TIDAL_CRUSH - ramp into 3e Water payoffs (maelstrom is new; capacitor fixed to 2e).
        decks: {
            "kraken_v1": ["whirlpool_v2", "whirlpool_v2", "pressure_point", "pressure_point", "ink_stream", "ink_stream", "surge_protection", "water_slap"],
            "kraken_v2": ["maelstrom", "hydro_blast", "capacitor", "capacitor", "surge_protection", "surge_protection", "water_slap", "water_slap"]
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
            attack: 62,
            defense: 95,
            energy: 2
        },
        primaryElement: "Earth",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["fafnir_v1", "fafnir_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "fafnir_v1": ["boulder_smash", "boulder_smash", "spike_launch", "spike_launch", "stone_fist", "shield_shards", "shield_shards", "stone_bark", "spiked_carapace", "keen_edge"],
            "fafnir_v2": ["boulder_smash", "boulder_smash", "spike_launch", "spike_launch", "stone_fist", "shield_shards", "shield_shards", "stone_bark", "spiked_carapace", "keen_edge"]
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
        cardDraw: 3,
        availableOS: ["skoll_v1", "skoll_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "skoll_v1": ["fury_strike", "fury_strike", "adrenaline", "adrenaline", "fire_punch_v2", "brute_force", "fire_punch_v2", "core_overclock_daemon", "water_slap"],
            "skoll_v2": ["ignite", "scorch", "fire_poke", "fire_poke", "cinder_slash", "cinder_slash", "fire_punch_v2", "fire_punch_v2", "water_slap"]
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
        cardDraw: 3,
        availableOS: ["jormungandr_v1", "jormungandr_v2"],
        // Ticket 16 (Henry-approved 2026-08-05): real per-OS decks.
        // v1 OUROBOROS - all-Water zero-cost storm (the loop counts WATER cards, so
        // nothing here may be None-tier); serpents_coil is the cards-played payoff.
        // v2 VENOM_TRENCH - tanky poison attrition into a contagion double-up.
        decks: {
            "jormungandr_v1": ["blind_spot", "poison_injection", "poison_injection", "corrosive_leak", "surge_protection", "surge_protection", "serpents_coil", "serpents_coil"],
            "jormungandr_v2": ["corrosive_bolt", "corrosive_bolt", "acid_splash", "acid_splash", "toxic_surge", "toxic_surge", "capacitor", "contagion"]
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
        cardDraw: 3,
        availableOS: ["gullinbursti_v1", "gullinbursti_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "gullinbursti_v1": ["rock_throw", "rock_throw", "stone_fist", "stone_fist", "tremor", "shield_shards", "keen_edge", "keen_edge", "stone_bark", "stone_bark"],
            "gullinbursti_v2": ["rock_throw", "rock_throw", "stone_fist", "stone_fist", "tremor", "shield_shards", "keen_edge", "keen_edge", "stone_bark", "stone_bark"]
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
        cardDraw: 4,
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
        cardDraw: 3,
        availableOS: ["sleipnir_v1", "sleipnir_v2"],
        // Ticket 21 (Air first pass): v1 MOMENTUM_DRIVE = zoo momentum - five 0-cost cards
        // feed the Strengthened engine, Stampede/Trample cash it. v2 WAR_STEED_OS = discard-cost
        // cavalry - the OS's free Hoof Strike tokens become the fodder Lance/Cavalry Charge spend.
        decks: {
            "sleipnir_v1": ["water_slap", "water_slap", "slipstream", "slipstream", "disorienting_gust", "adrenaline", "tailwind", "zephyr_strike", "stampede", "stampede", "momentum_crash", "hoofbeat_daemon"],
            "sleipnir_v2": ["lance", "lance", "cavalry_charge", "zephyr_strike", "zephyr_strike", "dust_devil", "tailwind", "water_slap"]
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
            energy: 3
        },
        primaryElement: "Nature",
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["ratatoskr_v1", "ratatoskr_v2"],
        // Ticket 04: the designed deck belongs to the v1 slot (GOSSIP_NODE); the other slot
        // holds a copy until its own deck lands (kraken first, ticket 14).
        // Ticket 32 (Henry's design): real per-OS decks. Ratatoskr is attack 55 - the lowest
        // frame in the roster - offset by 3 Energy and cardDraw 4, so both decks win on card
        // VOLUME, never on a multiplied single hit. That is also what separates him from
        // sleipnir_v1, which runs the same 0-cost fuel into a raw-Strength multiplier.
        // v1 GOSSIP_NODE - card spam. Five 0-costs, each of which echo_chamber turns into a
        //    Feedback token that re-triggers the OS (the daemon excludes tokens, the OS does
        //    not), so every real 0-cost is worth two procs. seed_bomb x2 is the payoff.
        // v2 INSTIGATOR_OS - Dazed stacking. Same fuel, opposite payoff: slander reads the
        //    target's RAW Dazed stacks and so ignores the +-25% cap the OS would otherwise
        //    pay into.
        decks: {
            "ratatoskr_v1": ["forage", "forage", "water_slap", "water_slap", "healing_mist", "squirrel_away", "nettle_sting", "nettle_sting", "seed_bomb_v2", "seed_bomb_v2", "echo_chamber_v2"],
            "ratatoskr_v2": ["pollen_cloud", "pollen_cloud", "water_slap", "water_slap", "nagging_bite", "nagging_bite", "crippling_vine", "slander", "echo_chamber_v2"]
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
        cardDraw: 3,
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
        cardDraw: 2,
        availableOS: ["ymir_v1", "ymir_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "ymir_v1": ["ice_spear", "ice_spear", "shatter", "shatter", "glacial_slam", "flash_freeze", "flash_freeze", "cold_snap", "glacier_wall", "glacier_wall"],
            "ymir_v2": ["ice_spear", "ice_spear", "shatter", "shatter", "glacial_slam", "flash_freeze", "flash_freeze", "cold_snap", "glacier_wall", "glacier_wall"]
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
            energy: 2
        },
        primaryElement: "Ice",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["draugr_v1", "draugr_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "draugr_v1": ["frost_jab", "frost_jab", "ice_spear", "ice_spear", "shatter", "cold_snap", "cold_snap", "hoarfrost", "winters_grasp", "glacier_wall"],
            "draugr_v2": ["frost_jab", "frost_jab", "ice_spear", "ice_spear", "shatter", "cold_snap", "cold_snap", "hoarfrost", "winters_grasp", "glacier_wall"]
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
        cardDraw: 3,
        availableOS: ["valkyrie_v1", "valkyrie_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "valkyrie_v1": ["radiant_spark", "radiant_spark", "smite", "smite", "smite", "lumen_surge", "lumen_surge", "scry", "healing_light", "aegis"],
            "valkyrie_v2": ["radiant_spark", "radiant_spark", "smite", "smite", "smite", "lumen_surge", "lumen_surge", "scry", "healing_light", "aegis"]
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
            attack: 60,
            defense: 90,
            energy: 3
        },
        primaryElement: "Light",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["audhumbla_v1", "audhumbla_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "audhumbla_v1": ["radiant_spark", "radiant_spark", "smite", "smite", "healing_light", "healing_light", "purify", "uplift", "uplift", "lumen_surge"],
            "audhumbla_v2": ["radiant_spark", "radiant_spark", "smite", "smite", "healing_light", "healing_light", "purify", "uplift", "uplift", "lumen_surge"]
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
        // At 110/105/95 the control sits at 52.2% overall AND discriminates across the full
        // range - nidhoggr 0%, huldra 0%, hel 25%, skoll 43%, hraesvelgr 79%, kraken 93%,
        // jormungandr 100%. On the median frame everything read 0-4% and the instrument had no
        // resolution at all.
        baseStats: {
            hp: 110,
            attack: 105,
            defense: 95,
            energy: 2
        },
        primaryElement: "None",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["control_v1"],
        decks: {
            "control_v1": ["baseline_jab", "baseline_jab", "baseline_scuff", "baseline_scuff", "baseline_strike", "baseline_strike", "baseline_snare", "baseline_snare", "baseline_slam", "baseline_slam"]
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
        cardDraw: 4,
        availableOS: ["hel_v1", "hel_v2"],
        // Ticket 36 (Henry's design): Hel is the roster's first dual-type Mingming (Dark/Light).
        // v1 TWILIGHT_CADENCE - the element she casts sets her stance at end of action, so the
        //    card that sets a stance never benefits from it, only the next one. Dark = +30%
        //    dealt, Light = -30% taken. None-element cards set NO stance, which makes Tackle
        //    and hamstring the only way to act without committing. eclipse cashes the brace.
        // v2 UNDERWORLD_GATEWAY - her cards cost no Energy at all; each one drains 5% maxHP per
        //    point of its PRINTED cost instead, so she is the only Mingming who casts 3e freely
        //    (soul_tithe) and her own hand is her clock (~24 HP on a full hand). Healing is
        //    boosted 1.5x at the OS so the heal cards stay on-curve.
        decks: {
            "hel_v1": ["shadow_claw", "shadow_claw", "pale_mercy", "pale_mercy", "water_slap", "nights_bite", "nights_bite", "purify", "lumen_surge", "hamstring", "eclipse"],
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
            defense: 80,
            energy: 2
        },
        primaryElement: "Dark",
        secondaryElement: "None",
        cardDraw: 3,
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
