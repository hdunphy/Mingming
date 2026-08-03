const fs = require('fs');
const path = 'src/engine/data/battleFactories.ts';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const newLines = `            const boss = createMockEntity(\`Gym Leader (\${gymElement})\`, bossId, playerLevel + 2);
            const superBoss: IBattleEntity = { 
                ...boss, 
                maxHp: boss.maxHp * 1.5, 
                currentHp: boss.maxHp * 1.5,
                // Assign Boss Relic
                activeOS: primaryElement === 'Water' || primaryElement === 'Nature' ? 'boss_relic_water' : 
                         primaryElement === 'Ice' || primaryElement === 'Dark' ? 'boss_relic_ice' : 'boss_relic_fire',
                moves: [
                    { id: 'boss_slam', name: 'Titan Slam', intentType: 'Attack', priority: 10, actions: [{ type: 'ATTACK', power: 25, element: primaryElement, target: 'Single' }] },
                    { id: 'boss_surge', name: 'System Surge', intentType: 'Buff', priority: 5, actions: [{ type: 'STATUS', status: 'Strengthened', stacks: 2, target: 'Self' }] },
                    { id: 'boss_blast', name: 'Core Blast', intentType: 'Attack', priority: 8, actions: [{ type: 'ATTACK', power: 15, element: 'None', target: 'Side' }] }
                ]
            };

            const guard1 = createMockEntity('Elite Guard', guardId, playerLevel);
            const guard2 = createMockEntity('Elite Guard', guardId, playerLevel);

            enemyParty = [guard1, superBoss, guard2]; // Boss in middle
            enemyDeckIds = [];`.split('\n');

// Lines 145 to 158 (1-indexed) are indices 144 to 157
lines.splice(144, 158 - 145 + 1, ...newLines);

fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully updated battleFactories.ts via splice');
