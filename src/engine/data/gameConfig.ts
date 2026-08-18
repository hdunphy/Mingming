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
        //
        // Ticket 62 (Henry, 2026-08-15): FOUR tiers, not three - the cap moved 3 -> 4 when
        // DETONATE shipped. The table is the SPREAD form: the 8% + 5%-shred top tier is
        // unchanged and the climb to it is one rung longer, so reaching maximum Burn costs an
        // extra application rather than an extra point of rate. Measured against the 21-arm
        // grid and the 36-arm cap/dial sweep - see research/burn-detonate-deep-sweep.md.
        //
        // NOTE what a cap raise actually does here, because it is not what it sounds like
        // (HANDOFF 0-BURN-CAP): spreading the tiers lengthens the climb as well as raising the
        // ceiling, so a higher cap makes the whole status WEAKER, not merely harder to
        // overflow. Tick output falls before any detonation is counted. That is priced in.
        burnStacks: [
            { damagePercent: 0.015, defShredPercent: 0 },
            { damagePercent: 0.03, defShredPercent: 0.01 },
            { damagePercent: 0.05, defShredPercent: 0.025 },
            { damagePercent: 0.08, defShredPercent: 0.05 }
        ]
    }
}