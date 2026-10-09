/**
 * TICKET 205 - THE WORDS OF A CARD EFFECT LINE, moved out of `CardHand.tsx` so the line can be drawn
 * (and tested) on its own. The symbol that began each line (a sword, a heart, a bolt ...) is gone from
 * the text: `EffectLine` draws the Tabler icon `cardEffectIcons.ts` names for the action, then these
 * words. Nothing about the wording changed.
 */

import type { ProgramAction } from '../../engine/types';

/**
 * One line per action, in the player's terms.
 *
 * # IT NAMES THE PRINTED POWER AGAIN — THE LAW IS RETIRED (Henry, 2026-09-11)
 *
 * This helper was the counter-example tickets 13 and 15 cited by name: it printed `action.power`
 * straight out of the data, so `fire_punch_v2` read "30 Fire dmg" (after the sword) in every caster's hand alike.
 * Ticket 22 stripped the figure and left the SHAPE ("Damage ×2 hits").
 *
 * Henry has now retired the law that required that: *"without it players can't compare cards ...
 * We still need to understand power on each card."* The original objection is still true — one
 * `power` in front of three casters produces three different HP swings — but it was an argument
 * for labelling the number honestly, not for hiding it. So the line says **power**, in those
 * words, and the card face's readout beside it says what this caster actually does to that
 * target. Two numbers that never claimed to be the same one.
 */
/*
 * TICKET 160-e1 — an ally card's actions say "an ally", not "the target".
 *
 * `describeAction` reads the ACTION, which only knows `SELF` or `TARGET`; whether a target is a
 * friend is a property of the CARD. So the card's flag is threaded in rather than inferred, and
 * the word changes for every action on it at once — a card that says "an ally gains 3 Sharp" and
 * a tooltip that says "→ the target" is the tooltip the flag exists to fix.
 */
export const describeAction = (action: ProgramAction, allyTarget = false): string => {
    /*
     * ── TICKET 155g — WRITTEN AGAINST THE REAL UNION ────────────────────────────────────────
     *
     * Henry, 2026-09-19: *"tooltips are not very helpful"*, with a screenshot reading
     * "STATUS STATUS STATUS".
     *
     * This switched on `APPLY_STATUS`, `REMOVE_STATUS` and `ADD_ENERGY` — three names that are not
     * in `ActionType` and never have been. The real ones are `STATUS`, `CLEANSE` and `ENERGY`, so
     * every status card fell through to `default: return action.type` and printed the enum. The
     * `as string` cast above the switch is what hid it: it widened the discriminant so TypeScript
     * could not tell anyone the cases were unreachable. It is gone, and the `never` check at the
     * bottom means a new `ActionType` is a compile error here rather than a card that explains
     * itself as "TAUNT".
     */
    switch (action.type) {
        case 'ATTACK': {
            const hits = Math.max(1, action.count ?? 1);
            const p = typeof action.power === 'number' ? `${action.power} power` : 'Damage';
            if (action.target === 'SELF') return `Recoil onto the caster — ${p}${hits > 1 ? ` ×${hits}` : ''}`;
            return `${p}${hits > 1 ? ` ×${hits} hits` : ''}`;
        }
        case 'HEAL': {
            const who = action.target === 'SELF' ? '' : allyTarget ? ' an ally' : '';
            return typeof action.power === 'number'
                ? `Heals${who} with ${action.power} power`
                : `Restores${who ? who + "'s" : ''} HP`;
        }
        case 'STATUS': {
            // The headline case, and the one that printed "STATUS". Says what lands, how much of
            // it, and on whom — the three things a player is asking.
            const stacks = action.stacks ?? 1;
            const where = action.target === 'SELF' ? 'the caster'
                : action.target === 'Side' || action.target === 'SIDE' ? (allyTarget ? 'your whole side' : 'their whole side')
                : action.target === 'All' || action.target === 'ALL' ? 'everyone'
                : allyTarget ? 'the chosen ally'
                : 'the target';
            return `${stacks}× ${action.status} → ${where}`;
        }
        case 'CLEANSE':
            return `Clears ${action.status ? String(action.status) : 'every status'}`;
        case 'ENERGY':
            return `${(action.amount ?? 0) >= 0 ? '+' : ''}${action.amount ?? 0} Energy`;
        case 'MAX_ENERGY':
            return `+${action.amount ?? 0} max Energy for the battle`;
        case 'DRAW':
            return `Draw ${action.count ?? 1}`;
        case 'DISCARD':
            return `Discard ${action.count ?? 1}`;
        case 'FORCE_DISCARD':
            return `The target discards ${action.count ?? 1}`;
        case 'EXHAUST':
            return `Exhausts ${action.count ?? 1} — gone for the fight`;
        case 'RETURN':
            return `Returns ${action.count ?? 1} from the discard`;
        case 'SEARCH':
            return `Search the deck for a card`;
        case 'GENERATE_CARD':
            return `Adds a card to your hand`;
        case 'MULTIPLY_STATUS':
            return `Doubles ${action.status ? String(action.status) : 'a status'} on the target`;
        case 'TRIGGER_STATUS':
            return `Makes ${action.status ? String(action.status) : 'a status'} tick now`;
        case 'PLAY_LAST_CARD':
            return `Replays the last card you cast`;
        case 'TAUNT':
            return `Forces the target to attack the caster`;
        case 'BUFF_NEXT_PROGRAM':
            return `Strengthens the next card you play`;
        case 'REDIRECT_TARGET':
            return `Redirects the incoming attack`;
        case 'SHIFT_STANCE':
            return `Shifts stance`;
        case 'REVIVE':
            return `Revives a fallen ally`;
        default: {
            /*
             * EXHAUSTIVE. `never` here means adding an `ActionType` breaks this build rather than
             * shipping a card whose tooltip reads as its own enum — which is exactly what the
             * `as string` cast let happen for three action types.
             */
            const unreachable: never = action.type;
            return String(unreachable);
        }
    }
};
