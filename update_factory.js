const fs = require('fs');
const path = 'src/engine/data/battleFactories.ts';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = `            const boss = createMockEntity(\`Gym Leader (\${gymElement})\`, bossId, playerLevel + 2);
            const superBoss = { ...boss, maxHp: boss.maxHp * 1.5, currentHp: boss.maxHp * 1.5 };
            const guard1 = createMockEntity('Elite Guard', guardId, playerLevel);
            const guard2 = createMockEntity('Elite Guard', guardId, playerLevel);

            enemyParty = [guard1, superBoss, guard2]; // Boss in middle

            if (primaryElement === 'Water') {
                enemyDeckIds = ['feedback_loop_daemon', 'corrosive_bolt', 'toxic_surge', 'toxic_surge', 'surge_protection', 'poison_injection', 'acid_splash'];
            } else if (primaryElement === 'Nature') {
                enemyDeckIds = ['fertile_ground_daemon', 'seed_bomb_v2', 'seed_bomb_v2', 'crippling_vine', 'pollen_cloud', 'rejuvenation'];
            } else {
                enemyDeckIds = ['fenrir_v1_daemon', 'fire_punch_v2', 'fire_punch_v2', 'scorch', 'cinder_slash', 'fury_strike'];
            }`;

const newBlock = `            const boss = createMockEntity(\`Gym Leader (\${gymElement})\`, bossId, playerLevel + 2);
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
            enemyDeckIds = []; // No longer using decks for bosses`;

// Normalizing whitespace for a better match
const normalize = (s) => s.replace(/\r\n/g, '\n').trim();
const normContent = content.replace(/\r\n/g, '\n');
const normOldBlock = normalize(oldBlock);

if (normContent.includes(normOldBlock)) {
    const updatedContent = normContent.replace(normOldBlock, newBlock.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, updatedContent);
    console.log('Successfully updated battleFactories.ts');
} else {
    console.error('Could not find the target block in battleFactories.ts');
    // Log content slice for debugging
    const start = normContent.indexOf('Tier 3 (Gym Leader)');
    if (start !== -1) {
        console.log('Found start and block around it:');
        console.log(normContent.substring(start, start + 500));
    }
}
