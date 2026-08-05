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
            "fenrir_v1": ["fire_poke", "fire_poke", "cinder_slash", "cinder_slash", "glass_cannon", "ignite", "ignite", "scorch", "ash_reclamation", "reckless_charge"],
            "fenrir_v2": ["fire_poke", "fire_poke", "cinder_slash", "cinder_slash", "glass_cannon", "ignite", "ignite", "scorch", "ash_reclamation", "reckless_charge"]
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
            "kraken_v1": ["whirlpool_v2", "whirlpool_v2", "pressure_point", "pressure_point", "ink_stream", "ink_stream", "ink_cloud", "water_slap"],
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
            hp: 60,
            attack: 105,
            defense: 55,
            energy: 2
        },
        primaryElement: "Fire",
        secondaryElement: "None",
        cardDraw: 3,
        availableOS: ["skoll_v1", "skoll_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "skoll_v1": ["fury_strike", "fury_strike", "fury_strike", "fire_punch_v2", "fire_punch_v2", "overdrive", "reckless_charge", "reckless_charge", "strength_burst", "all_in"],
            "skoll_v2": ["fury_strike", "fury_strike", "fury_strike", "fire_punch_v2", "fire_punch_v2", "overdrive", "reckless_charge", "reckless_charge", "strength_burst", "all_in"]
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
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "hraesvelgr_v1": ["gale_slash", "gale_slash", "cyclone", "cyclone", "gust_jab", "disorienting_gust", "disorienting_gust", "tailwind", "slipstream", "sky_dance"],
            "hraesvelgr_v2": ["gale_slash", "gale_slash", "cyclone", "cyclone", "gust_jab", "disorienting_gust", "disorienting_gust", "tailwind", "slipstream", "sky_dance"]
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
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "sleipnir_v1": ["gust_jab", "gust_jab", "zephyr_strike", "zephyr_strike", "dust_devil", "dust_devil", "slipstream", "slipstream", "tailwind", "disorienting_gust"],
            "sleipnir_v2": ["gust_jab", "gust_jab", "zephyr_strike", "zephyr_strike", "dust_devil", "dust_devil", "slipstream", "slipstream", "tailwind", "disorienting_gust"]
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
        decks: {
            "ratatoskr_v1": ["leaf_blade", "leaf_blade", "nettle_sting", "nettle_sting", "thistle_barrage", "pollen_cloud", "photosynthesis_v2", "photosynthesis_v2", "healing_mist", "soothe"],
            "ratatoskr_v2": ["leaf_blade", "leaf_blade", "nettle_sting", "nettle_sting", "thistle_barrage", "pollen_cloud", "photosynthesis_v2", "photosynthesis_v2", "healing_mist", "soothe"]
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
        decks: {
            "huldra_v1": ["leaf_blade", "leaf_blade", "nettle_sting", "nettle_sting", "stunning_strike", "sleep_powder", "sleep_powder", "crippling_vine", "rejuvenation", "overgrowth"],
            "huldra_v2": ["leaf_blade", "leaf_blade", "nettle_sting", "nettle_sting", "stunning_strike", "sleep_powder", "sleep_powder", "crippling_vine", "rejuvenation", "overgrowth"]
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
        secondaryElement: "None",
        cardDraw: 4,
        availableOS: ["hel_v1", "hel_v2"],
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "hel_v1": ["shadow_claw", "leech_strike", "leech_strike", "drain_life", "drain_life", "curse_mark", "nightfall_edge", "dawns_respite", "umbral_feast", "dark_pact"],
            "hel_v2": ["shadow_claw", "leech_strike", "leech_strike", "drain_life", "drain_life", "curse_mark", "nightfall_edge", "dawns_respite", "umbral_feast", "dark_pact"]
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
        // Ticket 13: both slots hold the legacy shared deck until this species' deck pass.
        decks: {
            "nidhoggr_v1": ["shadow_claw", "shadow_claw", "night_terror", "night_terror", "leech_strike", "venom_shade", "venom_shade", "creeping_dread", "curse_mark", "umbral_feast"],
            "nidhoggr_v2": ["shadow_claw", "shadow_claw", "night_terror", "night_terror", "leech_strike", "venom_shade", "venom_shade", "creeping_dread", "curse_mark", "umbral_feast"]
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
