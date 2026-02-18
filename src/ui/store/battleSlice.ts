import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { IBattleState } from '../../engine/types';
import { createBattleState } from '../../engine/data/battleFactories';
import { battleReducer } from '../../engine/battleReducer';
import type { IPlayerSave } from '../../engine/gameTypes';

export interface BattleUIState {
    battle: IBattleState | null;
    selectedSourceId: string | null;
    selectedTargetId: string | null;
    selectedCardId: string | null;
}

const initialState: BattleUIState = {
    battle: null,
    selectedSourceId: null,
    selectedTargetId: null,
    selectedCardId: null
};

const battleSlice = createSlice({
    name: 'battle',
    initialState,
    reducers: {
        playProgram: (state, action: PayloadAction<{ sourceId: string; targetId: string; programId: string }>) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, {
                    type: 'PLAY_PROGRAM',
                    payload: action.payload
                }) as any;
            }
        },
        endTurn: (state) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, { type: 'END_TURN' }) as any;
            }
        },
        transferEnergy: (state, action: PayloadAction<{ sourceId: string; targetId: string }>) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, {
                    type: 'TRANSFER_ENERGY',
                    payload: action.payload
                }) as any;
            }
        },
        selectCard: (state, action: PayloadAction<string | null>) => {
            state.selectedCardId = action.payload;
        },
        selectTarget: (state, action: PayloadAction<string | null>) => {
            state.selectedTargetId = action.payload;
        },
        selectSource: (state, action: PayloadAction<string | null>) => {
            state.selectedSourceId = action.payload;
        },
        setBattleState: (state, action: PayloadAction<IBattleState | null>) => {
            state.battle = action.payload as any;
        },
        startBattle: (state, action: PayloadAction<{ save: IPlayerSave; enemyIds: string[] }>) => {
            state.battle = createBattleState(action.payload.save, action.payload.enemyIds) as any;
            state.selectedSourceId = null;
            state.selectedTargetId = null;
            state.selectedCardId = null;
        },
        dismissLevelUp: (state) => {
            if (state.battle) {
                state.battle.levelUpQueue = state.battle.levelUpQueue.slice(1);
            }
        }
    }
});

export const {
    playProgram,
    endTurn,
    transferEnergy,
    selectCard,
    selectTarget,
    selectSource,
    setBattleState,
    startBattle,
    dismissLevelUp
} = battleSlice.actions;

export default battleSlice.reducer;
