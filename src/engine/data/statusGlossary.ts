/**
 * Player-facing glossary for every status effect.
 *
 * IMPORTANT: These descriptions are derived from the actual mechanics in
 * StatusBehaviors.ts, effectHandlers.ts (duality cancellation), core/Hooks.ts
 * (damage modifiers) and battleReducer.ts (energy refill, CC recovery).
 * If a behavior changes, update the matching entry here.
 */
import type { StatusType } from '../types';

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
            'At end of turn, takes 1.5% / 3% / 5% / 8% of max HP as damage at 1 / 2 / 3 / 4 stacks (2+ stacks also shred defense), and decays 1 stack per turn. Caps at 4 stacks — going past the cap DETONATES for 14% of max HP and leaves the excess behind as the new pile.',
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
            'Cannot act. Always applied at 3 stacks (reapplying resets it to 3), and loses 1 stack per turn AND 1 stack per incoming attack - so three hits break it, absorbed ones included. Statuses and damage-over-time do not. Waking grants 1 turn of StableOS.',
    },
    Weakened: {
        name: 'Weakened',
        icon: '⬇️',
        description:
            'Deals 2% less damage per stack, up to -25% at 13 stacks. Permanent, but incoming Strengthened cancels it stack for stack.',
    },
    Strengthened: {
        name: 'Strengthened',
        icon: '⬆️',
        description:
            'Deals 2% more damage per stack, up to +25% at 13 stacks. Permanent, but incoming Weakened cancels it stack for stack.',
    },
    Dazed: {
        name: 'Dazed',
        icon: '💫',
        description:
            'Takes 2% more damage per stack, up to +25% at 13 stacks. Permanent, but incoming Sharp cancels it stack for stack.',
    },
    Sharp: {
        name: 'Sharp',
        icon: '🛡️',
        description:
            'Takes 2% less damage per stack, up to -25% at 13 stacks. Permanent, but incoming Dazed cancels it stack for stack.',
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
            'At end of turn, restores 5 HP per stack, then loses 1 stack.',
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
