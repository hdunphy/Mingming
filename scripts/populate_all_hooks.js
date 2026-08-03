import fs from 'fs';

const hooksJsonStr = fs.readFileSync('./src/engine/data/lib/hooks.json', 'utf8');
const hooksJson = JSON.parse(hooksJsonStr);

const emptyHooks = {
    "fafnir_v1": { "id": "fafnir_v1", "name": "HOARD_PROTOCOL", "description": "Unspent Energy is retained between turns, but Fafnir takes 1% maximum HP damage per hoarded Energy at the start of his turn.", "hooks": [] },
    "fafnir_v2": { "id": "fafnir_v2", "name": "CORRUPTED_GOLD_OS", "description": "Fafnir gains 1 Energy whenever a negative status effect is applied to him.", "hooks": [] },
    "gullinbursti_v1": { "id": "gullinbursti_v1", "name": "UNSTOPPABLE_MASS", "description": "Playing a defensive Status card reduces the Energy cost of the next Attack card you play this turn by 1.", "hooks": [] },
    "gullinbursti_v2": { "id": "gullinbursti_v2", "name": "KINETIC_RAM_OS", "description": "Earth Attack cards deal additional damage equal to Gullinbursti's current stacks of Sharp.", "hooks": [] },
    "hraesvelgr_v1": { "id": "hraesvelgr_v1", "name": "GALE_FORCE_OS", "description": "Whenever you voluntarily discard a card from your hand, deal moderate Air damage to a random enemy.", "hooks": [] },
    "hraesvelgr_v2": { "id": "hraesvelgr_v2", "name": "UPDRAFT_KERNEL", "description": "The first time you cycle through your entire deck and shuffle your discard pile, permanently gain +1 max Energy for the rest of the battle.", "hooks": [] },
    "sleipnir_v1": {
        "id": "sleipnir_v1", "name": "MOMENTUM_DRIVE", "description": "Whenever you play a card that costs 0 Energy, Sleipnir gains 1 stack of Strengthened.",
        "hooks": [{
            "id": "sleipnir_v1_hook", "trigger": "onActionStart", "priority": 40,
            "when": { "source": "SELF", "baseCost": 0 },
            "do": [{ "type": "STATUS", "target": "SELF", "status": "Strengthened", "stacks": 1 }]
        }]
    },
    "sleipnir_v2": {
        "id": "sleipnir_v2", "name": "WAR_STEED_OS", "description": "Whenever Sleipnir plays an Air Attack card, generate a 0-cost Hoof Strike token card in your hand.",
        "hooks": [{
            "id": "sleipnir_v2_hook", "trigger": "onActionStart", "priority": 40,
            "when": { "source": "SELF", "programElement": "Air", "actionType": "ATTACK" },
            "do": [{ "type": "GENERATE_CARD", "target": "SELF", "dataId": "hoof_strike" }, { "type": "LOG", "text": "{owner}'s WAR_STEED_OS generates a Hoof Strike!" }]
        }]
    },
    "huldra_v1": {
        "id": "huldra_v1", "name": "ALLURE_PROXY", "description": "Whenever Huldra applies a buff to herself or an ally, she mirrors it by applying 1 stack of Weakened to a random enemy.",
        "hooks": [{
            "id": "huldra_v1_hook", "trigger": "onStatusApplied", "priority": 40,
            "when": { "source": "SELF", "target": "ALLY" },
            "do": [{ "type": "STATUS", "target": "RANDOM_ENEMY", "status": "Weakened", "stacks": 1 }]
        }] // Slightly simplified to always do Weakened for ease of implementation
    },
    "huldra_v2": {
        "id": "huldra_v2", "name": "BARK_SHIELD_OS", "description": "Huldra starts every battle with a massive, temporary shield.",
        "hooks": []
    },
    "ymir_v1": {
        "id": "ymir_v1", "name": "RIME_HEART_SYS", "description": "Enemies that deal damage to the Jötunn automatically receive 1 stack of Weakened.",
        "hooks": [{
            "id": "ymir_v1_hook", "trigger": "onPostDamage", "priority": 40,
            "when": { "target": "SELF", "source": "OPPONENT" },
            "do": [{ "type": "STATUS", "target": "SOURCE", "status": "Weakened", "stacks": 1 }] // Need SOURCE target
        }]
    },
    "ymir_v2": { "id": "ymir_v2", "name": "GLACIAL_PACE_OS", "description": "Jötunn cannot play more than 2 cards per turn, but all Ice cards deal 50% more base damage.", "hooks": [] },
    "draugr_v1": { "id": "draugr_v1", "name": "PERMAFROST_WAKE", "description": "Whenever a Draugr recovers from the Asleep status or is revived, it gains 3 strength.", "hooks": [] },
    "draugr_v2": { "id": "draugr_v2", "name": "GRAVE_CHILL_OS", "description": "Enemies afflicted with 2 or more negative status effects cost 1 additional Energy to execute their attacks against the Draugr.", "hooks": [] },
    "valkyrie_v1": { "id": "valkyrie_v1", "name": "VALHALLA_UPLINK", "description": "Whenever a Valkyrie applies a positive status to an ally, that ally also heals for 5% of their max HP.", "hooks": [] },
    "valkyrie_v2": { "id": "valkyrie_v2", "name": "EINHERJAR_RALLY", "description": "For every other active Mingming currently on your side of the field, Valkyrie's Light attacks deal +10% damage.", "hooks": [] },
    "audhumbla_v1": {
        "id": "audhumbla_v1", "name": "GENESIS_FIRMWARE", "description": "Every 3rd Heal or Spell card played permanently increases Audhumbla's maximum Energy pool by 1 for the remainder of the battle.",
        "hooks": []
    },
    "audhumbla_v2": { "id": "audhumbla_v2", "name": "NOURISH_ROUTINE", "description": "Any healing applied to Audhumbla that exceeds her maximum HP is automatically converted into an offensive Light attack against a random enemy.", "hooks": [] },
    "hel_v1": { "id": "hel_v1", "name": "EQUINOX_TOGGLE", "description": "Hel shifts stances based on the cards she plays.", "hooks": [] },
    "hel_v2": { "id": "hel_v2", "name": "UNDERWORLD_GATEWAY", "description": "Hel's Dark spells cost HP instead of Energy.", "hooks": [] },
    "nidhoggr_v1": { "id": "nidhoggr_v1", "name": "ROOT_CORRUPTION", "description": "Poison applied by Níðhöggr does not decrease in stacks at the end of the turn.", "hooks": [] },
    "nidhoggr_v2": {
        "id": "nidhoggr_v2", "name": "FALLEN_FEAST_OS", "description": "Whenever any Mingming is defeated, Níðhöggr gains 3 stacks of Strengthened and 3 stacks of Sharp.",
        "hooks": []
    }
}

Object.assign(hooksJson, emptyHooks);
fs.writeFileSync('./src/engine/data/lib/hooks.json', JSON.stringify(hooksJson, null, 4));
console.log('Added remaining Norse Mingming stubs to hooks.json');
