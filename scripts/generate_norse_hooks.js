import fs from 'fs';

const hooksJsonStr = fs.readFileSync('./src/engine/data/lib/hooks.json', 'utf8');
const hooksJson = JSON.parse(hooksJsonStr);

const newHooks = {
    "skoll_v1": {
        "id": "skoll_v1",
        "name": "TREACHERY_KERNEL",
        "description": "Whenever an allied Mingming takes damage from an enemy attack, Sköll gains 1 stack of Strengthened.",
        "hooks": [
            {
                "id": "skoll_v1_hook",
                "trigger": "onPostDamage",
                "priority": 40,
                "when": {
                    "source": "OPPONENT",
                    "target": "ALLY"
                },
                "do": [
                    {
                        "type": "STATUS",
                        "target": "SELF",
                        "status": "Strengthened",
                        "stacks": 1
                    }
                ]
            }
        ]
    },
    "skoll_v2": {
        "id": "skoll_v2",
        "name": "SOLAR_FLARE_OS",
        "description": "Whenever you play a Fire card against a target with 3 or more stacks of Burn, refund 1 Energy.",
        "hooks": [
            {
                "id": "skoll_v2_hook",
                "trigger": "onActionStart",
                "priority": 40,
                "when": {
                    "source": "SELF",
                    "programElement": "Fire",
                    "targetStatus": { "status": "Burn", "minStacks": 3 }
                },
                "do": [
                    {
                        "type": "ENERGY",
                        "target": "SELF",
                        "amount": 1
                    },
                    {
                        "type": "LOG",
                        "text": "{owner}'s SOLAR_FLARE_OS refunds 1 Energy!"
                    }
                ]
            }
        ]
    },
    "jormungandr_v1": {
        "id": "jormungandr_v1",
        "name": "OUROBOROS_LOOP",
        "description": "Every 3rd Water card you play in a single turn grants 1 Energy and draws 1 card.",
        "hooks": [
            {
                "id": "jorm_v1_count",
                "trigger": "onActionStart",
                "priority": 50,
                "when": { "source": "SELF", "programElement": "Water" },
                "do": [{ "type": "COUNTER", "key": "jorm_water", "operator": "ADD", "amount": 1 }]
            },
            {
                "id": "jorm_v1_trigger",
                "trigger": "onActionStart",
                "priority": 40,
                "when": { "source": "SELF", "programElement": "Water", "counter": { "key": "jorm_water", "operator": "EQ", "value": 3 } },
                "do": [
                    { "type": "ENERGY", "target": "SELF", "amount": 1 },
                    { "type": "DRAW", "amount": 1 },
                    { "type": "COUNTER", "key": "jorm_water", "operator": "RESET" },
                    { "type": "LOG", "text": "{owner}'s OUROBOROS_LOOP triggers!" }
                ]
            },
            {
                "id": "jorm_v1_reset",
                "trigger": "onTurnEnd",
                "priority": 40,
                "do": [{ "type": "COUNTER", "key": "jorm_water", "operator": "RESET" }]
            }
        ]
    },
    "jormungandr_v2": {
        "id": "jormungandr_v2",
        "name": "VENOM_TRENCH_OS",
        "description": "At the end of the turn, Jörmungandr heals 2 HP.",
        "hooks": [
            {
                "id": "jorm_v2_heal",
                "trigger": "onTurnEnd",
                "priority": 50,
                "do": [
                    { "type": "HEAL", "target": "SELF", "healOverride": 2 }
                ]
            }
        ]
    }
};

Object.assign(hooksJson, newHooks);
fs.writeFileSync('./src/engine/data/lib/hooks.json', JSON.stringify(hooksJson, null, 4));
console.log('Added Sköll and Jörmungandr to hooks.json');
