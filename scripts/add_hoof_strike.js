import fs from 'fs';

const path = './src/engine/data/programs.json';
const dataStr = fs.readFileSync(path, 'utf8');
const data = JSON.parse(dataStr);

data['hoof_strike'] = {
    "id": "hoof_strike",
    "name": "Hoof Strike",
    "description": "A quick, momentum-driven strike from Sleipnir.",
    "element": "Air",
    "target": "Single",
    "category": "Attack",
    "rarity": "Token",
    "baseCost": 0,
    "isToken": true,
    "actions": [
        {
            "type": "ATTACK",
            "power": 12,
            "target": "TARGET"
        }
    ]
};

fs.writeFileSync(path, JSON.stringify(data, null, 4));
console.log('Added hoof_strike to programs.json');
