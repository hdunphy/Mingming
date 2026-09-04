/**
 * TICKET 139 — the printed text must agree with the data underneath it.
 *
 * WHY THIS FILE EXISTS. Ticket 138 found four cards whose descriptions disagreed with their own
 * actions, and every one was found by accident while changing something else. The worst had been
 * wrong for months: Regen's glossary line was wrong on the TIMING, the AMOUNT and what a STACK IS,
 * all in one sentence. A wrong description is a balance problem wearing a documentation costume -
 * the roster is tuned against what the engine does, so text that disagrees means the measured game
 * and the played game are two different games.
 *
 * WHAT IT DOES. Walks every card and every firmware, pulls the numbers out of the prose, pulls the
 * numbers out of the data, and fails when a printed number has no counterpart. It resolves what it
 * can rather than exempting it: per-stack rates that live in engine code are READ from the engine
 * (`SHARP_STACKS_POWER_PER_STACK`, `MISSING_HP_PCT_CAP`, `STANCE_BONUS`), a daemon's numbers are
 * looked up in its hook entry, and a card-level `growPerPlay` counts.
 *
 * **THE ALLOWLIST IS THE DELIVERABLE.** Everything it cannot resolve is named below with a reason,
 * and each entry is a place where text and data are related BY CODE rather than by equality. That
 * relationship was written down nowhere before this file.
 *
 * It has already earned its place: writing it caught three live defects that 138's hand pass had
 * missed - `nightfall_edge` and `dawns_respite` still printed the OLD stance bonus (30%, against a
 * knob that ticket 77 moved to 35 and ticket 136q moved to 45 - so both cards had been wrong
 * through two rulings), and `hoofbeat_daemon` printed 10 damage against a hook that ticket 25's
 * curve pass had re-priced to 8. All three were fixed in the same commit.
 */
import { describe, it, expect } from 'vitest';
import PROGRAMS from './programs.json';
import HOOKS from './lib/hooks.json';
import { SHARP_STACKS_POWER_PER_STACK, MISSING_HP_PCT_CAP } from '../actions/ActionExecutors';
import { STANCE_BONUS } from '../core/Hooks';
import { statusGlossary } from './statusGlossary';
import { REGEN_PERCENT_PER_TURN, POISON_PERCENT_PER_STACK, BURN_CONFIG } from '../StatusBehaviors';

type Loose = Record<string, unknown>;
const CARDS = PROGRAMS as unknown as Record<string, Loose>;
const FIRMWARE = HOOKS as unknown as Record<string, Loose>;

/**
 * Numbers a PLAYER reads as a quantity. Two kinds of number are stripped first because they name
 * something other than an amount:
 *   - a COST reference ("0-cost card", "2 or more Energy") names what the card reads, not what it does
 *   - a UNIT rate ("+0.7 power per 1% of your max HP") names the denominator, not a quantity
 */
function describedNumbers(text: string): number[] {
    const cleaned = text
        .replace(/\d+(?:\.\d+)?[- ](?:cost|Energy)/gi, ' ')
        .replace(/\d+(?:\.\d+)?\s+or\s+more\s+Energy/gi, ' ')
        .replace(/per \d+(?:\.\d+)?%/gi, ' ');
    return [...new Set((cleaned.match(/\d+(?:\.\d+)?/g) ?? []).map(Number))];
}

const NUMERIC_KEYS = new Set([
    'power', 'stacks', 'amount', 'count', 'percentMaxHp', 'percentMaxHP',
    'factor', 'scalingPower', 'powerBonus', 'bonus', 'minStacks', 'growPerPlay',
    // A threshold IS a printed number: "2 or more debuffs", "the 5th Water card".
    'value',
]);

/** Every number reachable in a blob of card/hook data, as a player would meet it. */
function dataNumbers(node: unknown, acc = new Set<number>()): Set<number> {
    if (Array.isArray(node)) { node.forEach(n => dataNumbers(n, acc)); return acc; }
    if (!node || typeof node !== 'object') return acc;
    for (const [key, value] of Object.entries(node as Loose)) {
        if (NUMERIC_KEYS.has(key) && typeof value === 'number') acc.add(Math.abs(value));
        // A multiplier is printed as the percentage it moves damage BY, not as the factor.
        if (key === 'multiplier' && typeof value === 'number') {
            acc.add(Math.round(Math.abs(1 - value) * 100));
            acc.add(Math.round(value * 100));
        }
        // "GT:50" in a HEALTH_THRESHOLD conditional.
        if (key === 'value' && typeof value === 'string') {
            const n = value.match(/\d+/);
            if (n) acc.add(Number(n[0]));
        }
        // Rates that live in ENGINE CODE, resolved rather than exempted.
        if (key === 'scaling' && value === 'SHARP_STACKS') acc.add(SHARP_STACKS_POWER_PER_STACK);
        if (key === 'scaling' && value === 'MISSING_HP') acc.add(MISSING_HP_PCT_CAP);
        if (key === 'status' && (value === 'DarkStance' || value === 'LightStance')) {
            acc.add(Math.round(STANCE_BONUS.dark * 100));
            acc.add(Math.round(STANCE_BONUS.light * 100));
        }
        if (key === 'type' && value === 'SHIFT_STANCE') {
            acc.add(Math.round(STANCE_BONUS.dark * 100));
            acc.add(Math.round(STANCE_BONUS.light * 100));
        }
        dataNumbers(value, acc);
    }
    return acc;
}

/**
 * THE ALLOWLIST. Every entry is a place where the text and the data are related by CODE rather
 * than by equality — which is exactly the relationship nobody had written down.
 *
 * Adding an entry is a decision, not a formality: it says "a human checked, and this number cannot
 * be found in this card's own data". Prefer resolving it in `dataNumbers` above.
 */
const ALLOWED: Record<string, string> = {
    // --- the number lives in code that is not hook data: hand-written firmware, or a daemon
    //     whose behaviour is implemented in daemonHooks.ts rather than declared in hooks.json ---
    harden_daemon: 'daemonHooks.ts implements it; no actions and no hooks.json entry',
    core_overclock_daemon: 'daemonHooks.ts implements it; no actions and no hooks.json entry',
    war_molt: 'the discard payout is handled by the discard pipeline, not by an action',

    // --- arithmetic the extractor deliberately does not do ---
    molten_core: '"4 Burn" is 2 unconditional + 2 conditional; both halves are in the data',
    discharge: '"1 Burn per 2 removed" is the action ratio 0.5 stated the other way up',
    berserk_rush: 'the "below 50%" threshold is the standard complementary LT:51 (see blood_rite GT:50)',

    // --- RULED to stay as they are (ticket 133, Henry 2026-09-04) ---
    crimson_draw: 'percentage-vs-flat heal; RULED to stay (133) - one card overhealing is not the problem',
    ember_mend: 'percentage-vs-flat heal; RULED to stay (133) - one card overhealing is not the problem',
};

const ALLOWED_FIRMWARE: Record<string, string> = {
    fafnir_v1: 'HOARD_ENGINE is hand-written in CustomFirmware.ts (hooks: [])',
    skoll_v2: 'SOLAR_OVERDRIVE is hand-written in CustomFirmware.ts (hooks: [])',
    hraesvelgr_v2: 'UPDRAFT_KERNEL is hand-written in CustomFirmware.ts (hooks: [])',
    ymir_v2: 'GLACIAL_HEART is hand-written in CustomFirmware.ts (hooks: [])',
    hel_v2: 'UNDERWORLD_GATEWAY is hand-written in CustomFirmware.ts; its numbers are OS_KNOBS.hel',
    fenrir_v1: 'the 50% berserk clause is hand-written in CustomFirmware.ts (OS_KNOBS.fenrir)',
    ratatoskr_v1: 'GOSSIP_NODE percentage is applied in the heal path, not printed in the hook',
    driver_war_footing: 'the turn-4 escalation is a driver, evaluated outside the hook payload',
    reactive_plating: 'the per-turn grant cap lives in daemonHooks.ts, not in the hook payload',
    hoofbeat_daemon: 'daemon hook power is printed; the turn-gate number is in daemonHooks.ts',
};

describe('ticket 139 — every number a card prints is a number its data holds', () => {
    it('holds for every card in the registry', () => {
        const offenders: string[] = [];
        for (const [id, card] of Object.entries(CARDS)) {
            if (id in ALLOWED) continue;
            const described = describedNumbers(String(card.description ?? ''));
            if (described.length === 0) continue;
            const held = dataNumbers(card.actions ?? []);
            // A daemon's numbers live in its hook entry; look there too.
            if (FIRMWARE[id]) dataNumbers((FIRMWARE[id] as Loose).hooks, held);
            if (typeof card.growPerPlay === 'number') held.add(Math.abs(card.growPerPlay));
            const orphans = described.filter(n => !held.has(n));
            if (orphans.length) offenders.push(`${id}: prints ${orphans.join(', ')} — "${card.description}"`);
        }
        expect(offenders, 'resolve it in dataNumbers, fix the text, or add a reasoned ALLOWED entry').toEqual([]);
    });

    it('holds for every firmware description', () => {
        const offenders: string[] = [];
        for (const [id, entry] of Object.entries(FIRMWARE)) {
            if (id in ALLOWED_FIRMWARE) continue;
            const described = describedNumbers(String(entry.description ?? ''));
            if (described.length === 0) continue;
            const held = dataNumbers(entry.hooks ?? []);
            const orphans = described.filter(n => !held.has(n));
            if (orphans.length) offenders.push(`${id}: prints ${orphans.join(', ')} — "${entry.description}"`);
        }
        expect(offenders, 'resolve it, fix the text, or add a reasoned ALLOWED_FIRMWARE entry').toEqual([]);
    });

    /**
     * An allowlist nobody prunes becomes a way of hiding defects. This fails if an entry names a
     * card that no longer exists, or one that would now pass on its own.
     */
    it('has no stale allowlist entries', () => {
        const stale: string[] = [];
        for (const id of Object.keys(ALLOWED)) {
            if (!CARDS[id]) { stale.push(`${id} (no such card)`); continue; }
            const described = describedNumbers(String(CARDS[id].description ?? ''));
            const held = dataNumbers(CARDS[id].actions ?? []);
            if (FIRMWARE[id]) dataNumbers((FIRMWARE[id] as Loose).hooks, held);
            if (typeof CARDS[id].growPerPlay === 'number') held.add(Math.abs(CARDS[id].growPerPlay as number));
            if (described.every(n => held.has(n))) stale.push(`${id} (passes now — drop the exemption)`);
        }
        for (const id of Object.keys(ALLOWED_FIRMWARE)) {
            if (!FIRMWARE[id]) stale.push(`${id} (no such firmware)`);
        }
        expect(stale, 'the allowlist has entries that are no longer earning their place').toEqual([]);
    });
});

/**
 * The status glossary is what a player reads for a MECHANIC rather than a card, and it had no test
 * at all — which is how Regen's entry came to be wrong on three counts at once. Pinned against the
 * engine constants, so a future move of either one fails here.
 */
describe('ticket 139 — the status glossary agrees with the engine', () => {
    it('Regen names the engine percentage', () => {
        expect(statusGlossary.Regen.description)
            .toContain(`${Math.round(REGEN_PERCENT_PER_TURN * 100)}%`);
    });

    it('Poison names the engine percentage', () => {
        expect(statusGlossary.Poison.description)
            .toContain(`${Math.round(POISON_PERCENT_PER_STACK * 100)}%`);
    });

    it('Burn names its real cap', () => {
        expect(statusGlossary.Burn.description).toContain(`Caps at ${BURN_CONFIG.maxStacks} stacks`);
    });
});
