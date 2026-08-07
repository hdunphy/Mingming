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
        // Ticket 26: rescaled by 0.665. Burn is % of maxHP so it bypasses calculateDamage
        // entirely - tickets 23, 24 and 25 cut attacks three times and left Burn untouched,
        // leaving status far stronger than priced. Defense shred is unchanged: it is a % of
        // defense, not of the damage curve.
        burnStacks: [
            { damagePercent: 0.015, defShredPercent: 0 },
            { damagePercent: 0.035, defShredPercent: 0.01 },
            { damagePercent: 0.08, defShredPercent: 0.05 }
        ]
    }
}