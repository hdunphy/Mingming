/**
 * Player-facing glossary for every status effect.
 *
 * IMPORTANT: These descriptions are derived from the actual mechanics in
 * StatusBehaviors.ts, effectHandlers.ts (duality cancellation), core/Hooks.ts
 * (damage modifiers) and battleReducer.ts (energy refill, CC recovery).
 * If a behavior changes, update the matching entry here.
 */
import type { StatusType } from '../types';
import { STATUS_MODEL } from '../core/Hooks';

/**
 * TICKET 102: the four duality statuses are re-denominated in POWER, and their text is DERIVED
 * from `STATUS_MODEL` rather than written out - the ticket-90 lesson was that a hand-written
 * tooltip goes stale silently and then lies to the player by a factor of ten. Under PERCENT the
 * text still reads as a percentage against the cap; under POWER it reads as flat power with no
 * ceiling, which is the live rule.
 */
const dualityRule = (direction: 'more' | 'less', who: 'Deals' | 'Takes'): string =>
    STATUS_MODEL.shape === 'POWER'
        ? `${who} ${STATUS_MODEL.powerPerStack} ${direction} POWER per stack - no cap, and it rides `
          + `type advantage and resistances like a card's own power. A typical 1-Energy attack is `
          + `about 40 power, so ten stacks is a quarter of a card.`
        : `${who} ${(STATUS_MODEL.pctPerStack * 100).toFixed(0)}% ${direction} damage per stack, up to `
          + `${direction === 'more' ? '+' : '-'}${(STATUS_MODEL.pctCap * 100).toFixed(0)}% at `
          + `${Math.ceil(STATUS_MODEL.pctCap / STATUS_MODEL.pctPerStack)} stacks.`;

export interface StatusGlossaryEntry {
    name: string;
    icon?: string;
    description: string;
}

export const statusGlossary: Record<StatusType, StatusGlossaryEntry> = {
    Burn: {
        name: 'Burn',
        icon: '🔥',
        description:
            'At end of turn, takes 1.5% / 3% / 5% / 8% of max HP as damage at 1 / 2 / 3 / 4 stacks (2+ stacks also shred defense). PERMANENT — the pile does not decay. Caps at 4 stacks — going past the cap DETONATES for 14% of max HP and leaves the excess behind as the new pile.',
    },
    Poison: {
        name: 'Poison',
        icon: '☠️',
        description:
            'At end of turn, takes 1% of max HP as damage per stack (minimum 1), then loses 1 stack. Applied stacks scale with the attacker\'s Attack and the card\'s power.',
    },
    Asleep: {
        name: 'Asleep',
        icon: '💤',
        description:
            'Cannot act. Applied at 3 stacks; reapplying while asleep does nothing, so it can never be extended. Loses 1 stack per turn AND 1 stack per incoming attack - so three hits break it, absorbed ones included. Statuses and damage-over-time do not. Waking grants 1 turn of StableOS, which refuses Asleep and Stunned outright.',
    },
    Weakened: {
        name: 'Weakened',
        icon: '⬇️',
        description:
            `${dualityRule('less', 'Deals')} Permanent, but incoming Strengthened cancels it stack for stack.`,
    },
    Strengthened: {
        name: 'Strengthened',
        icon: '⬆️',
        description:
            `${dualityRule('more', 'Deals')} Permanent, but incoming Weakened cancels it stack for stack.`,
    },
    Dazed: {
        name: 'Dazed',
        icon: '💫',
        description:
            `${dualityRule('more', 'Takes')} Permanent, but incoming Sharp cancels it stack for stack.`,
    },
    Sharp: {
        name: 'Sharp',
        icon: '🛡️',
        description:
            `${dualityRule('less', 'Takes')} Permanent, but incoming Dazed cancels it stack for stack.`,
    },
    Stunned: {
        name: 'Stunned',
        icon: '⚡',
        description:
            'Cannot act this turn. Does not stack; wears off at end of turn and then grants 1 turn of StableOS.',
    },
    Regen: {
        name: 'Regen',
        icon: '💚',
        description:
            'At the start of your turn, restores 2% of max HP, then loses 1 stack (stacks are turns).',
    },
    Energized: {
        name: 'Energized',
        icon: '🔋',
        description:
            'At the next energy refill, gain 1 bonus energy per stack — even beyond the energy cap. All stacks are consumed by that refill.',
    },
    StableOS: {
        name: 'StableOS',
        icon: '💠',
        description:
            'System stabilized: immune to Stunned and Asleep. Wears off at end of turn.',
    },
    BarkShield: {
        name: 'Bark Shield',
        icon: '🪵',
        description:
            'Absorbs incoming damage point for point before HP is touched; breaks at 0. Decays by 20% of its remaining strength at end of turn.',
    },
    DarkStance: {
        name: 'Dark Stance',
        icon: '☾',
        description:
            'While in Dark Stance, this unit deals +30% damage. decays 1 stack per turn and caps at 1 stack — but entering Light Stance replaces it.',
    },
    LightStance: {
        name: 'Light Stance',
        icon: '☀',
        description:
            'While in Light Stance, this unit takes 30% less damage. decays 1 stack per turn and caps at 1 stack — but entering Dark Stance replaces it.',
    },
};

/** Neon accent color per status, shared by unit badges and card chips. */
export const STATUS_COLORS: Record<StatusType, string> = {
    Burn: '#ff6633',
    Poison: '#88cc22',
    Asleep: '#8888ff',
    Weakened: '#ff8888',
    Strengthened: '#44ddff',
    Dazed: '#cc88ff',
    Sharp: '#aaaaaa',
    Stunned: '#ffcc00',
    Regen: '#22cc88',
    Energized: '#00e5ff',
    StableOS: '#00d2ff',
    BarkShield: '#b58d4c',
    DarkStance: '#a347ff',
    LightStance: '#ffd700',
};
