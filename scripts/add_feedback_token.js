import fs from 'fs';

const path = './src/engine/data/programs.json';
const dataStr = fs.readFileSync(path, 'utf8');
const data = JSON.parse(dataStr);

data['feedback_token'] = {
    "id": "feedback_token",
    "name": "Feedback",
    "description": "Ratatoskr's retaliatory damage token.",
    "element": "None",
    "target": "Single",
    "category": "Attack",
    "rarity": "Token",
    "baseCost": 0,
    "isToken": true,
    "actions": [
        {
            "type": "ATTACK",
            "power": 3,
            "target": "TARGET"
        }
    ]
};

fs.writeFileSync(path, JSON.stringify(data, null, 4));
console.log('Added feedback_token to programs.json');
