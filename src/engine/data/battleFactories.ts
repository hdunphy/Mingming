import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState, IDeckState } from '../types';
import type { IPlayerSave } from '../gameTypes';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';
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

export function createMockDeck(isWater: boolean = false): string[] {
    // Using original 34-card core deck IDs from Registry
    return isWater ? [
        'squirt', 'water_jet', 'whirlpool', 'bathe', 'scald',
        'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate',
        'rain', 'drink_tea', 'hydro_pump', 'cannon_ball', 'hot_springs', 'nightmare'
    ]
        : [
            'reckless', 'flamethrower', 'erupt', 'rage', 'charge', 'radiate', 'fired_up',
            'toats', 'roast', 'spicy_breath', 'preheat', 'flash', 'fire_punch'
        ];
}

export function instantiateDeck(deckIds: string[]): ProgramEntity[] {
    return deckIds.map(id => ({
        id: crypto.randomUUID(),
        dataId: id,
        currentCost: GetProgramData(id).baseCost,
        isPlayable: true
    }));
}

export function createBattleState(save: IPlayerSave, enemyIds: string[]): IBattleState {
    const playerPartyMembers = save.activeParty
        .map(id => save.roster.find(m => m.id === id))
        .filter(Boolean) as IMingmingState[];

    if (playerPartyMembers.length === 0) throw new Error("No active Mingming found in save!");

    const playerParty = playerPartyMembers.map(mm => initializeBattleEntity(mm, GetMingmingData(mm.definitionId)));
    const enemyLevel = Math.max(...playerParty.map(p => p.level));
    const enemyParty = enemyIds.map(enemyId => createMockEntity('Wild ' + GetMingmingData(enemyId).name, enemyId, enemyLevel));

    // Updated Deck Logic: Pick a random subset of 9 cards + the Daemon for the archetype
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

    const enemyDeckIds = enemyIds.map(enemyId => {
        const def = GetMingmingData(enemyId);
        let archetype: 'FENRIR' | 'KRAKEN' | 'RATATOSKR' = 'FENRIR';
        if (def.primaryElement === 'Water') archetype = 'KRAKEN';
        if (def.primaryElement === 'Nature') archetype = 'RATATOSKR';
        return getArchetypeDeck(archetype);
    }).flat();

    const eDeckCardsRaw = instantiateDeck(enemyDeckIds);
    const { shuffled: eDeckCards, nextSeed: seedAfterEnemyShuffle } = new PRNG(seedAfterPlayerShuffle.toString()).shuffle(eDeckCardsRaw);

    //Keep this we will also use this for 3v3s
    const playerCardDraw = playerParty.reduce((sum, e) => sum + e.cardDraw, 0) - playerParty.length + 1;
    const enemyCardDraw = enemyParty.reduce((sum, e) => sum + e.cardDraw, 0) - enemyParty.length + 1;

    const pInitialDeck: IDeckState = {
        ownerId: 'PLAYER',
        deck: [],
        drawpile: pDeckCards,
        hand: [],
        discard: []
    };
    const { state: pDeckState, nextSeed: seed2 } = drawCards(pInitialDeck, playerCardDraw, seedAfterEnemyShuffle.toString());

    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: eDeckCards,
        hand: [],
        discard: []
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
        levelUpQueue: []
    };
}
