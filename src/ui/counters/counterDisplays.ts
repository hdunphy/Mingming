/**
 * TICKET 184c — **WHICH COUNTERS EXIST, AND WHAT THEY SAY.**
 *
 * Henry, 2026-10-01: *"jorm draw on 5th water card needs a counter next to his OS. Any other OS
 * that have a counter or something should have visual feedback."* Ruled the same day: all of
 * them, this ticket — firmware, Drivers and daemons.
 *
 * This file is the declaration: an id, a kind (`counterKinds.ts`), the counter's key as the engine
 * writes it, and the words. No UI code knows which OS it is drawing. Limits are read from the
 * hook's own gate wherever the hook has one (`'gate'`), so a patch that changes the gate changes
 * the pip; the few hand-written firmware (`CustomFirmware.ts`) have no data gate and name their
 * number from the same `OS_KNOBS` the engine reads.
 *
 * NOT HERE, on purpose (listed in the 184 report): `valkyrie_v1` (its guard only stops a double
 * fire inside one turn end), `driver_frayed_signal` / `driver_static_haze` (they fire at the start
 * of the first turn, before the player can see anything), and `driver_root_rot`'s re-entry guard.
 * None of them is a number the player could play toward.
 */

import { OS_KNOBS } from '../../engine/core/CustomFirmware';
import { counterValue } from './counterReads';
import { liveCounter, oneShotCounter, perTurnCounter, progressCounter } from './counterKinds';
import type { CounterReader } from './counterTypes';

const USED_THIS_TURN = 'Used this turn; back next turn.';

/** Wrap a reader so it disappears once a one-time guard is set (UPDRAFT after it has paid). */
function untilFired(guard: { key: string }, reader: CounterReader): CounterReader {
    return (context) => (counterValue(context.state, context.owner, guard) > 0 ? null : reader(context));
}

// ─── FIRMWARE ───────────────────────────────────────────────────────────────────────────────────

export const FIRMWARE_COUNTERS: Readonly<Partial<Record<string, CounterReader>>> = {
    // OUROBOROS_LOOP — the one Henry named. "Each turn, the 5th Water card your side plays draws 1."
    jormungandr_v1: progressCounter({
        count: { key: 'jorm_water' },
        target: 'gate',
        uses: { key: 'jorm_ouroboros_used' },
        // 184d: SPLITTER makes any card count, and AMPLIFIER makes it draw 2 — the words follow the
        // patched hook data rather than assuming the unpatched firmware.
        describe: (value, target, { hooks }) => {
            const counted = hooks.find((hook) => hook.id === 'jorm_v1_count');
            const what = counted?.when?.programElement ? `${counted.when.programElement} cards` : 'Cards';
            const draw = hooks.flatMap((hook) => ((hook as { do?: Array<{ type?: string; amount?: number }> }).do ?? []))
                .find((action) => action.type === 'DRAW')?.amount ?? 1;
            const card = what === 'Cards' ? 'Card' : `${what.replace(/s$/, '')}`;
            return `${what} this turn: ${value} of ${target}. ${card} ${target} draws ${draw === 1 ? 'a card' : `${draw} cards`}.`;
        },
        spentText: (allowed) => (allowed > 1
            ? `Drew ${allowed} times this turn; back next turn.`
            : 'Drew its card this turn; back next turn.'),
    }),

    // BARK_SHIELD_OS — a one-time wall at the end of Huldra's OWN first turn (194a): the player's
    // Huldra raises it when the player's turn ends, an enemy Huldra when the enemy's does. The
    // words say which, because "her first turn" read as the player's end-turn for an enemy.
    huldra_v2: oneShotCounter({
        fired: { key: 'huldra_shield_init' },
        armedText: ({ state, owner }) => (state.playerParty.some((member) => member.id === owner.id)
            ? 'Raises its Bark Shields when your first turn ends.'
            : 'Raises its Bark Shields at the end of the enemy\'s first turn.'),
    }),

    // UNBOUND_KERNEL's berserk clause — not a counter but a live number, ruled in (decision 3).
    fenrir_v1: liveCounter(({ owner }) => {
        const missing = 1 - owner.currentHp / Math.max(1, owner.maxHp);
        const pct = Math.floor(OS_KNOBS.fenrir.berserkPct * missing * 100);
        if (pct <= 0 || owner.currentHp <= 0) return null;
        const cap = Math.round(OS_KNOBS.fenrir.berserkPct * 100);
        return {
            text: `+${pct}%`,
            state: 'live',
            tooltip: `Fenrir's Fire attacks deal ${pct}% more right now. Grows as he loses HP, up to ${cap}%.`,
        };
    }),

    // Post-launch firmware. Same pip, so an enemy running one shows it too.
    audhumbla_v1: perTurnCounter({
        used: { key: 'audhumbla_genesis_used' },
        limit: 'gate',
        readyText: () => 'Overheal Audhumbla this turn to gain 1 max Energy.',
        spentText: 'Max Energy already gained this turn; back next turn.',
    }),

    hraesvelgr_v2: untilFired({ key: 'hraesvelgr_max_energy' }, progressCounter({
        count: { key: 'deck_shuffles', scope: 'GLOBAL' },
        target: OS_KNOBS.hraes.shufflesNeeded,
        describe: (value, target) => `Deck shuffles: ${value} of ${target}. Then +1 max Energy for the rest of the battle.`,
    })),

    hel_v2: liveCounter(({ owner, state }) => {
        const spent = counterValue(state, owner, { key: 'hel_blood_spent' });
        const cap = OS_KNOBS.hel.capPct;
        return {
            text: `${spent}/${cap}%`,
            state: spent >= cap ? 'spent' : 'counting',
            tooltip: `Max HP spent on Dark spells this turn: ${spent}% of ${cap}%.`,
        };
    }),

    fafnir_v1: liveCounter(({ owner, state }) => {
        const hoard = counterValue(state, owner, { key: 'fafnir_hoard' });
        if (hoard <= 0) return null;
        return {
            text: `HOARD ${hoard}`,
            state: 'live',
            tooltip: `${hoard} Energy hoarded. At the start of the next turn it costs ${hoard}% of max HP (at least 1).`,
        };
    }),
};

// ─── DRIVERS (party-wide; the owner is the first member of the party) ──────────────────────────

export const DRIVER_COUNTERS: Readonly<Partial<Record<string, CounterReader>>> = {
    driver_tidal_surge: progressCounter({
        count: { key: 'tidal_surge', scope: 'SIDE' },
        target: 'gate',
        describe: (value, target) => `Cards played: ${value} of ${target}. Card ${target} hits the enemy side for 10 power.`,
    }),

    driver_tenth_strike: progressCounter({
        count: { key: 'tenth_strike', scope: 'SIDE' },
        target: 'gate',
        describe: (value, target) => `Attack cards played: ${value} of ${target}. Attack ${target} deals 50% more damage.`,
    }),

    // The gate is `EQ 1` (the first attack), not a use limit, so the limit is named.
    driver_first_blood: perTurnCounter({
        used: { key: 'first_blood', scope: 'SIDE' },
        limit: 1,
        readyText: () => 'Your first attack card this turn deals 20% more damage.',
        spentText: USED_THIS_TURN,
    }),

    driver_deep_cache: perTurnCounter({
        used: { key: 'deep_cache', scope: 'SIDE' },
        limit: 'gate',
        readyText: () => 'The first bonus draw this turn gives the drawer 1 Strengthened.',
        spentText: USED_THIS_TURN,
    }),

    // Once per MEMBER per fight, so the pip counts the members still armed.
    driver_bulwark_reflex: liveCounter(({ state }) => {
        const armed = state.playerParty.filter((member) =>
            member.currentHp > 0 && counterValue(state, member, { key: 'bulwark_reflex', scope: 'OWNER' }) === 0);
        if (armed.length === 0) return null;
        return {
            text: `${armed.length} ARMED`,
            state: 'armed',
            tooltip: `Still armed (15 Bark Shield the first time they drop below 50% HP): ${armed.map((m) => m.name).join(', ')}.`,
        };
    }),
};

// ─── DAEMONS (keyed by the daemon card's id) ─────────────────────────────────────────────────────

const reactivePlating = (key: string): CounterReader => perTurnCounter({
    used: { key, scope: 'SIDE' },
    limit: 'gate',
    readyText: (left, allowed) => `Sharp it can still grant this turn: ${left} of ${allowed}.`,
    spentText: 'Granted all its Sharp this turn; back next turn.',
});

export const DAEMON_COUNTERS: Readonly<Partial<Record<string, CounterReader>>> = {
    reactive_plating: reactivePlating('reactive_plating_grants'),
    'reactive_plating+': reactivePlating('reactive_plating_plus_grants'),
    'echo_chamber+': perTurnCounter({
        used: { key: 'echo_chamber_plus_encore', scope: 'OWNER' },
        limit: 'gate',
        readyText: () => 'The first 0-cost card this turn makes two Tattle tokens.',
        spentText: 'Two-token bonus used this turn; back next turn.',
    }),
};
