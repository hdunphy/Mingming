import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { IBattleState } from '../../engine/types';
import { createBattleState } from '../../engine/data/battleFactories';
import type { BattleOptions, IBattleSetup } from '../../engine/data/battleFactories';
import { battleReducer } from '../../engine/battleReducer';

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
        /**
         * Ticket 15: fire a macro. The battle half only — spending the slot is `runSlice.consumeMacro`
         * (no reducer can write two slices), and `BattleArena` dispatches both after
         * `canFireMacro` has said the shot will land.
         */
        fireMacro: (state, action: PayloadAction<{ macroId: string; sourceId: string; targetId: string }>) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, {
                    type: 'FIRE_MACRO',
                    payload: action.payload
                }) as any;
            }
        },
        endTurn: (state) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, { type: 'END_TURN' }) as any;
            }
        },
        /**
         * **NOTHING DISPATCHES THIS — unwired pending a ruling, and deliberately so.**
         *
         * Ticket 22 (3v3 game-side completion) audited every player-facing path in a fight and found
         * this one has no caller: no component, no hotkey, no card. The reducer half is real and
         * tested, but the 3v3 ruling never mentions party Energy transfer, so the ticket rules that
         * Henry decides keep-or-cut and that **no UI may be built for it until he does**. Wiring a
         * button to it would be the mistake; so would deleting it. It stays exactly as it is.
         *
         * See the docblock on `BattleAction`'s `TRANSFER_ENERGY` member in `battleReducer.ts`.
         */
        transferEnergy: (state, action: PayloadAction<{ sourceId: string; targetId: string }>) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, {
                    type: 'TRANSFER_ENERGY',
                    payload: action.payload
                }) as any;
            }
        },
        executeIntent: (state, action: PayloadAction<{ sourceId: string }>) => {
            if (state.battle) {
                state.battle = battleReducer(state.battle, {
                    type: 'EXECUTE_INTENT',
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
        /**
         * Ticket 11: the payload carries an `IBattleSetup`, not a save. The caller resolves the
         * run's party against the ranch roster (`engine/run/battleSetup.ts`) before dispatching, so
         * the battle slice never has to know which slice a fighter came out of.
         */
        startBattle: (state, action: PayloadAction<{ setup: IBattleSetup; enemyIds: string[]; sectorElement?: any; options?: BattleOptions }>) => {
            // options carries seed + enemyMode; dropping it here made
            // enemyMode: 'CARDS' and seeded battles unreachable from the UI.
            state.battle = createBattleState(
                action.payload.setup,
                action.payload.enemyIds,
                action.payload.sectorElement,
                action.payload.options
            ) as any;
            state.selectedSourceId = null;
            state.selectedTargetId = null;
            state.selectedCardId = null;
        }
    }
});

export const {
    playProgram,
    fireMacro,
    endTurn,
    transferEnergy,
    executeIntent,
    selectCard,
    selectTarget,
    selectSource,
    setBattleState,
    startBattle
} = battleSlice.actions;

export default battleSlice.reducer;
