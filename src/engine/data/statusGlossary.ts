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
            'At end of turn, takes 2% / 5% / 12% of max HP as damage at 1 / 2 / 3 stacks (2+ stacks also shred defense), and never wears off on its own. Caps at 3 stacks — excess stacks instead detonate immediately for top-tier damage each.',
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
            'Cannot act. Always applied at 3 stacks (reapplying resets it to 3), loses 1 stack per turn, and taking any damage wakes the sleeper; waking grants 1 turn of StableOS.',
    },
    Weakened: {
        name: 'Weakened',
        icon: '⬇️',
        description:
            'Deals 20% less damage per stack (never below 10%). Permanent, but incoming Strengthened cancels it stack for stack.',
    },
    Strengthened: {
        name: 'Strengthened',
        icon: '⬆️',
        description:
            'Deals 20% more damage per stack. Permanent, but incoming Weakened cancels it stack for stack.',
    },
    Dazed: {
        name: 'Dazed',
        icon: '💫',
        description:
            'Takes 20% more damage per stack. Permanent, but incoming Sharp cancels it stack for stack.',
    },
    Sharp: {
        name: 'Sharp',
        icon: '🛡️',
        description:
            'Takes 20% less damage per stack (never below 10%). Permanent, but incoming Dazed cancels it stack for stack.',
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
};
