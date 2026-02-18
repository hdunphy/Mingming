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
        artReference: "Fafnir.png"
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
        artReference: "Skoll.png"
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
        artReference: "Jormungandr.png"
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
        artReference: "Gullinbursti.png"
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
        artReference: "Hraesvelgr.png"
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
        artReference: "Sleipnir.png"
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
        artReference: "Huldra.png"
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
        artReference: "Ymir.png"
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
        artReference: "Draugr.png"
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
        artReference: "Valkyrie.png"
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
        artReference: "Audhumbla.png"
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
        artReference: "Hel.png"
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
        artReference: "Nidhoggr.png"
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
            artReference: ''
        };
    }
    return data;
};