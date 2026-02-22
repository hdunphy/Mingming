import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState, IDeckState } from '../types';
import type { IPlayerSave } from '../gameTypes';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';
import { GetRelic } from './relicRegistry';
import { drawCards } from '../deckLogic';
import { PRNG } from '../core/PRNG';

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

import { generateEncounter } from './EncounterGenerator';
import type { Element } from '../types';

export function createBattleState(
    save: IPlayerSave,
    enemyIds: string[],
    sectorElement?: Element
): IBattleState {
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
                    currentHp: persistentState.hp,
                    currentEnergy: persistentState.energy
                };
            }
        }

        // Milestone 8.4: Relic Application
        save.relics.forEach(relicId => {
            const relic = GetRelic(relicId);
            if (relic.effect === 'ENERGY_CAP_BONUS') {
                entity = {
                    ...entity,
                    maxEnergy: entity.maxEnergy + 5,
                    currentEnergy: entity.currentEnergy + 5
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
            // Tier 3 (Gym Leader): Hand-crafted boss party
            let bossId = 'fenrir';
            let guardId = 'fenrir';
            if (primaryElement === 'Water') { bossId = 'kraken'; guardId = 'kraken'; }
            if (primaryElement === 'Nature') { bossId = 'ratatoskr'; guardId = 'ratatoskr'; }

            const boss = createMockEntity(`Gym Leader (${gymElement})`, bossId, playerLevel + 2);
            const superBoss = { ...boss, maxHp: boss.maxHp * 1.5, currentHp: boss.maxHp * 1.5 };
            const guard1 = createMockEntity('Elite Guard', guardId, playerLevel);
            const guard2 = createMockEntity('Elite Guard', guardId, playerLevel);

            enemyParty = [guard1, superBoss, guard2]; // Boss in middle

            if (primaryElement === 'Water') {
                enemyDeckIds = ['recursion_daemon', 'tidal_crush', 'whirlpool', 'whirlpool', 'renew', 'hypnosis', 'hypnosis'];
            } else if (primaryElement === 'Nature') {
                enemyDeckIds = ['echo_chamber_daemon', 'seed_bomb', 'seed_bomb', 'root_bind', 'photosynthesis', 'photosynthesis'];
            } else {
                enemyDeckIds = ['thermal_overload', 'solar_flare', 'solar_flare', 'ignite_pipeline', 'fire_punch', 'reckless'];
            }
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
                FENRIR: { daemon: 'thermal_overload', cards: ['singularity', 'solar_flare', 'ignite_pipeline', 'flash', 'fire_punch', 'reckless'] },
                KRAKEN: { daemon: 'recursion_daemon', cards: ['squirt', 'deep_pressure', 'whirlpool', 'renew', 'tidal_crush', 'ebb_and_flow', 'wave', 'hypnosis'] },
                RATATOSKR: { daemon: 'echo_chamber_daemon', cards: ['gossip', 'pruning', 'nettle_lash', 'photosynthesis', 'grafting', 'seed_bomb', 'root_bind'] }
            };
            const list = lists[archetype];
            return [list.daemon, ...list.cards.slice(0, 9)];
        }).flat();
    }

    // Epic 2/22/2026: Disable OS on enemies as they use intents now
    enemyParty = enemyParty.map(e => ({ ...e, activeOS: undefined }));

    // --- SHARED DECK INITIALIZATION ---

    // Updated Player Deck Logic: Archetype pick from starter
    const getArchetypeDeck = (archetype: 'FENRIR' | 'KRAKEN' | 'RATATOSKR'): string[] => {
        const lists = {
            FENRIR: {
                daemon: 'thermal_overload',
                cards: ['singularity', 'solar_flare', 'solar_flare', 'ignite_pipeline', 'ignite_pipeline', 'flash', 'preheat', 'ash_to_ash', 'fire_punch', 'fire_punch', 'reckless']
            },
            KRAKEN: {
                daemon: 'recursion_daemon',
                cards: ['squirt', 'squirt', 'deep_pressure', 'deep_pressure', 'whirlpool', 'whirlpool', 'renew', 'tidal_crush', 'ebb_and_flow', 'wave', 'hypnosis']
            },
            RATATOSKR: {
                daemon: 'echo_chamber_daemon',
                cards: ['gossip', 'gossip', 'pruning', 'pruning', 'nettle_lash', 'nettle_lash', 'photosynthesis', 'grafting', 'seed_bomb', 'seed_bomb', 'root_bind']
            }
        };

        const list = lists[archetype];
        const prng = new PRNG(Date.now().toString());
        const { shuffled } = prng.shuffle(list.cards);
        return [list.daemon, ...shuffled.slice(0, 9)];
    };

    const playerArchetype = playerParty[0].definitionId.toUpperCase() as any;
    const playerDeckIds = getArchetypeDeck(['FENRIR', 'KRAKEN', 'RATATOSKR'].includes(playerArchetype) ? playerArchetype : 'FENRIR');

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

    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: eDeckCards,
        hand: [],
        discard: [],
        exhaust: []
    };
    const { state: eDeckState, nextSeed: seed3 } = drawCards(eInitialDeck, enemyCardDraw, seed2);

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
        enemyParty: enemyParty,
        playerDeck: pDeckState,
        enemyDeck: eDeckState,
        cardsPlayedThisTurn: 0,
        levelUpQueue: [],
        activeRelics: save.relics || []
    };
}
