interface BurnStack {
    damagePercent: number;
    defShredPercent: number;
}

export interface GameConfig {
    status: {
        burnStacks: BurnStack[];
    }
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
    status: {
        burnStacks: [
            { damagePercent: 0.02, defShredPercent: 0 },
            { damagePercent: 0.05, defShredPercent: 0.01 },
            { damagePercent: 0.12, defShredPercent: 0.05 }
        ]
    }
}