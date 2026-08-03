import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState, IDeckState } from '../types';
import type { IPlayerSave } from '../gameTypes';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';
import { GetRelic } from './relicRegistry';
import { drawCards } from '../deckLogic';
import { PRNG } from '../core/PRNG';
import { generateIntents } from '../core/IntentUtils';

export function createMockEntity(name: string, mingmingId: string = 'fenrir', level: number = 10, experience: number = 0): IBattleEntity {
    const definition = GetMingmingData(mingmingId);

    const instance: IMingmingState = {
        id: crypto.randomUUID(),
        definitionId: mingmingId,
        nickname: name,
        level: level,
        experience: experience,
        blueprintsCollected: 0,
        hpIV: Math.floor(Math.random() * 32),
        attackIV: Math.floor(Math.random() * 32),
        defenseIV: Math.floor(Math.random() * 32),
    };

    return initializeBattleEntity(instance, definition);
}

export function instantiateDeck(deckIds: string[]): ProgramEntity[] {
    return deckIds.map((id, index) => {
        if (!id) console.error(`instantiateDeck got undefined at index ${index} in deckIds:`, deckIds);
        return {
            id: crypto.randomUUID(),
            dataId: id,
            currentCost: GetProgramData(id).baseCost,
            isPlayable: true
        };
    });
}

import { generateEncounter, getSectorSpecies } from './EncounterGenerator';
import type { Element, EnemyCombatMode } from '../types';

export interface BattleOptions {
    /**
     * How the enemy side fights, locked in at battle creation.
     * Defaults to 'MOVES' (telegraphed intents, no cards). Passing
     * 'CARDS' explicitly is the ONLY way to create card-playing enemies.
     */
    readonly enemyMode?: EnemyCombatMode;
}

export function createBattleState(
    save: IPlayerSave,
    enemyIds: string[],
    sectorElement?: Element,
    options?: BattleOptions
): IBattleState {
    const enemyMode: EnemyCombatMode = options?.enemyMode ?? 'MOVES';
    const playerPartyMembers = save.activeParty
        .map(id => save.roster.find(m => m.id === id))
        .filter(Boolean) as IMingmingState[];

    if (playerPartyMembers.length === 0) throw new Error("No active Mingming found in save!");

    const playerParty = playerPartyMembers.map(mm => {
        let entity = initializeBattleEntity(mm, GetMingmingData(mm.definitionId));

        // Milestone 8.3: Gauntlet Persistence
        if (save.gauntlet) {
            const persistentState = save.gauntlet.persistedStats[mm.id];
            if (persistentState) {
                entity = {
                    ...entity,
                    currentHp: persistentState.hp
                };
            }
        }

        // Milestone 8.4: Relic Application
        save.relics.forEach(relicId => {
            const relic = GetRelic(relicId);
            if (relic.effect === 'ENERGY_CAP_BONUS') {
                entity = {
                    ...entity,
                    maxEnergy: entity.maxEnergy + 1,
                    currentEnergy: entity.currentEnergy + 1
                };
            }
            if (relic.effect === 'DRAW_BONUS') {
                entity = {
                    ...entity,
                    cardDraw: entity.cardDraw + 1
                };
            }
            if (relic.effect === 'ATTACK_MULTIPLIER') {
                entity = {
                    ...entity,
                    relicBonuses: {
                        ...entity.relicBonuses!,
                        attackMod: entity.relicBonuses!.attackMod * 1.1
                    }
                };
            }
        });

        return entity;
    });

    let enemyParty: IBattleEntity[] = [];
    let enemyDeckIds: string[] = [];

    if (save.gauntlet && save.gauntlet.type === 'Gym') {
        const battleIndex = save.gauntlet.currentBattleIndex;
        const gymElement = save.gauntlet.element as Element;

        // Multi-Element Synergy
        const synergyMap: Record<string, Element[]> = {
            Fire: ['Fire', 'Earth'],
            Water: ['Water', 'Nature'],
            Ice: ['Ice', 'Dark'],
            Nature: ['Nature', 'Water']
        };
        const elementsToUse = synergyMap[gymElement] || [gymElement];
        const primaryElement = elementsToUse[0];
        const secondaryElement = elementsToUse[1] || primaryElement;

        const playerLevel = Math.max(...playerParty.map(p => p.level), 1);

        if (battleIndex === 0) {
            // Tier 1 (Grunt): Procedural 1-2 enemies
            const count = Math.random() > 0.5 ? 2 : 1;
            const encounter = generateEncounter({
                sectorElement: primaryElement,
                playerParty,
                seed: Date.now().toString()
            });
            enemyParty = encounter.enemyParty.slice(0, count);
            enemyDeckIds = encounter.enemyDeckIds;
        } else if (battleIndex === 1) {
            // Tier 2 (Elite): Procedural 3 enemies + synergistic deck
            const encounter = generateEncounter({
                sectorElement: secondaryElement,
                playerParty,
                seed: Date.now().toString()
            });
            enemyParty = encounter.enemyParty;
            enemyDeckIds = encounter.enemyDeckIds;
        } else {
            // Tier 3 (Gym Leader): Hand-crafted boss party.
            // Wardens come from the breach's own species pool so a Light breach
            // spawns Light wardens, not Fenrir. Fallback only guards against an
            // empty pool (never crash).
            const wardenPool = getSectorSpecies(primaryElement);
            const bossId = wardenPool[0]?.id ?? 'fenrir';
            const guardId = (wardenPool[1] ?? wardenPool[0])?.id ?? 'fenrir';

            const boss = createMockEntity(`${gymElement} Sector Warden`, bossId, playerLevel + 2);
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
            const guard1 = createMockEntity('Firewall Sentinel', guardId, playerLevel);
            const guard2 = createMockEntity('Firewall Sentinel', guardId, playerLevel);

            enemyParty = [guard1, superBoss, guard2]; // Boss in middle

            enemyDeckIds = []; // No longer using decks for bosses, logic now relies on 'moves'
        }
    } else if (sectorElement) {
        // Epic 8: Logic transition to Encounter Generator
        const encounter = generateEncounter({
            sectorElement,
            playerParty,
            seed: Date.now().toString()
        });
        enemyParty = encounter.enemyParty;
        enemyDeckIds = encounter.enemyDeckIds;
    } else {
        // Fallback or fixed encounters (e.g. initial dev test)
        const enemyLevel = Math.max(...playerParty.map(p => p.level));
        enemyParty = enemyIds.map(enemyId => createMockEntity('Wild ' + GetMingmingData(enemyId).name, enemyId, enemyLevel));

        // Use the old archetype logic for fixed encounters if needed, or simple direct IDs
        enemyDeckIds = enemyIds.map(enemyId => {
            const def = GetMingmingData(enemyId);
            let archetype: 'FENRIR' | 'KRAKEN' | 'RATATOSKR' = 'FENRIR';
            if (def.primaryElement === 'Water') archetype = 'KRAKEN';
            if (def.primaryElement === 'Nature') archetype = 'RATATOSKR';

            const lists = {
                FENRIR: { daemon: 'fenrir_v1_daemon', cards: ['fire_poke', 'fire_punch_v2', 'cinder_slash', 'brute_force', 'fury_strike', 'scorch'] },
                KRAKEN: { daemon: 'feedback_loop_daemon', cards: ['water_slap', 'whirlpool_v2', 'surge_protection', 'poison_injection', 'acid_splash', 'toxic_surge', 'corrosive_bolt', 'contagion'] },
                RATATOSKR: { daemon: 'fertile_ground_daemon', cards: ['leaf_blade', 'nettle_sting', 'thistle_barrage', 'seed_bomb_v2', 'soothe', 'pollen_cloud', 'crippling_vine'] }
            };
            const list = lists[archetype];
            return [list.daemon, ...list.cards.slice(0, 9)];
        }).flat();
    }

    // Epic 2/22/2026: Disable OS on enemies as they use intents now.
    // Exception: gym tier-3 bosses keep their boss_relic_* OS (design decision).
    enemyParty = enemyParty.map(e => ({
        ...e,
        activeOS: e.activeOS?.startsWith('boss_relic_') ? e.activeOS : undefined
    }));

    // --- SHARED DECK INITIALIZATION ---

    // Updated Player Deck Logic: Archetype pick from starter
    const getArchetypeDeck = (archetype: 'FENRIR' | 'KRAKEN' | 'RATATOSKR'): string[] => {
        const lists = {
            FENRIR: {
                daemon: 'fenrir_v1_daemon',
                cards: ['fire_poke', 'fire_punch_v2', 'fire_punch_v2', 'cinder_slash', 'cinder_slash', 'brute_force', 'fury_strike', 'scorch', 'ignite', 'ignite', 'strength_burst']
            },
            KRAKEN: {
                daemon: 'feedback_loop_daemon',
                cards: ['water_slap', 'water_slap', 'whirlpool_v2', 'whirlpool_v2', 'surge_protection', 'surge_protection', 'poison_injection', 'acid_splash', 'toxic_surge', 'corrosive_bolt', 'contagion']
            },
            RATATOSKR: {
                daemon: 'fertile_ground_daemon',
                cards: ['leaf_blade', 'leaf_blade', 'nettle_sting', 'nettle_sting', 'thistle_barrage', 'thistle_barrage', 'seed_bomb_v2', 'soothe', 'pollen_cloud', 'pollen_cloud', 'crippling_vine']
            }
        };

        const list = lists[archetype];
        const prng = new PRNG(Date.now().toString());
        const { shuffled } = prng.shuffle(list.cards);
        return [list.daemon, ...shuffled.slice(0, 9)];
    };

    const playerArchetype = playerParty[0].definitionId.toUpperCase() as any;

    let playerDeckIds: string[] = [];
    if (save.activeDeck && save.activeDeck.cards.length > 0) {
        playerDeckIds = save.activeDeck.cards.map(instanceId => {
            const card = save.cardInventory.find(c => c.instanceId === instanceId);
            return card ? card.dataId : null;
        }).filter(Boolean) as string[];
    } else {
        playerDeckIds = getArchetypeDeck(['FENRIR', 'KRAKEN', 'RATATOSKR'].includes(playerArchetype) ? playerArchetype : 'FENRIR');
    }

    const pDeckCardsRaw = instantiateDeck(playerDeckIds);
    const initialSeed = Date.now().toString();
    const { shuffled: pDeckCards, nextSeed: seedAfterPlayerShuffle } = new PRNG(initialSeed).shuffle(pDeckCardsRaw);

    const eDeckCardsRaw = instantiateDeck(enemyDeckIds);
    const { shuffled: eDeckCards, nextSeed: seedAfterEnemyShuffle } = new PRNG(seedAfterPlayerShuffle.toString()).shuffle(eDeckCardsRaw);

    const playerCardDraw = playerParty.reduce((sum, e) => sum + e.cardDraw, 0) - playerParty.length + 1;
    const enemyCardDraw = enemyParty.reduce((sum, e) => sum + e.cardDraw, 0) - enemyParty.length + 1;

    const pInitialDeck: IDeckState = {
        ownerId: 'PLAYER',
        deck: [],
        drawpile: pDeckCards,
        hand: [],
        discard: [],
        exhaust: []
    };
    const { state: pDeckState, nextSeed: seed2 } = drawCards(pInitialDeck, playerCardDraw, seedAfterEnemyShuffle.toString());

    // A battle with no enemies is unwinnable-by-definition and renders a ghost
    // arena (empty enemy column, instant hollow victory). Fail loudly instead.
    if (enemyParty.length === 0) {
        throw new Error(`[createBattleState] No enemies generated (gauntlet: ${JSON.stringify(save.gauntlet)}, sector: ${sectorElement}, enemyIds: ${JSON.stringify(enemyIds)})`);
    }

    // Move users get no drawpile/hand at all; card users get a dealt hand.
    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: enemyMode === 'CARDS' ? eDeckCards : [],
        hand: [],
        discard: [],
        exhaust: []
    };
    const { state: eDeckState, nextSeed: seed3 } = enemyMode === 'CARDS'
        ? drawCards(eInitialDeck, enemyCardDraw, seed2)
        : { state: eInitialDeck, nextSeed: seed2 };

    // Intents are only telegraphed for move users.
    const finalEnemyParty = enemyMode === 'MOVES'
        ? generateIntents(enemyParty, seed3, 1)
        : enemyParty;

    return {
        sessionId: 'battle_' + Date.now(),
        seed: seed3,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        osLogs: [],
        procs: [],
        playerParty: playerParty,
        enemyParty: finalEnemyParty,
        playerDeck: pDeckState,
        enemyDeck: eDeckState,
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        elementPlays: {
            'Fire': 0, 'Water': 0, 'Earth': 0, 'Air': 0, 'Nature': 0,
            'Ice': 0, 'Light': 0, 'Dark': 0, 'None': 0
        },
        counters: {},
        levelUpQueue: [],
        activeRelics: save.relics || [],
        enemyMode
    };
}
