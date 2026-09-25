/**
 * WHICH WORDS ON THE CARD A CONDITIONAL IS — so the hand can light them.
 *
 * `cardConditionals.ts` says whether a rider is true. This file says where it is printed, so the
 * true one can be highlighted in the description the player is already reading ("If the target is
 * Dazed, draw 1" turns green) rather than in a new row the card has no room for.
 *
 * # WHY A CLAUSE AND NOT THE WHOLE CARD
 *
 * Five of the thirty-eight conditional cards are either/or — `war_pact`, `battle_rhythm`,
 * `blood_rite`, `equilibrium`, and the HP half of their `+` prints. One branch of those is ALWAYS
 * true, so a card-level glow would be permanently on and say nothing. Lighting the clause says which
 * branch this cast will take.
 *
 * # HOW A CONDITIONAL IS FOUND IN FREE TEXT
 *
 * The description is authored prose, not generated from the actions, so this is a match and not a
 * derivation. It is kept honest two ways: the rules are narrow (a status rider needs its status word
 * AND a condition word in the same clause), and `conditionalClauses.test.ts` walks the whole registry
 * and fails if any conditional on any card maps to no clause. A new card whose text the rules cannot
 * place is a failing test, not a card that silently never lights.
 *
 * A clause is a sentence, or half of one split at `;` (blood_rite: "+15 power above half HP;
 * otherwise heal with 40 power"). Splitting needs whitespace after the mark, so "1.5" is not a break.
 */

import type { ProgramConstraint, ProgramData } from '../../engine/types';
import type { ConditionalReading } from './cardConditionals';

/** A half-open character range `[start, end)` into the description. */
export interface TextRange {
    readonly start: number;
    readonly end: number;
}

/** The words a player reads for each status a rider can ask about. Lower-case stems. */
const STATUS_WORDS: Readonly<Record<string, ReadonlyArray<string>>> = {
    Strengthened: ['strength'],
    Burn: ['burn'],
    BarkShield: ['shield', 'bark shield'],
    LightStance: ['light stance'],
    DarkStance: ['dark stance'],
};

const CONDITION_CUE = /\b(if|while|when|unless)\b/i;
const ABOVE = /\babove\b|\bover half\b|>\s*\d+%/i;
const BELOW = /\bbelow\b|<\s*\d+%/i;
const OTHERWISE = /\b(otherwise|else)\b/i;

/** Split a description into clause ranges — sentences, and `;` halves of sentences. */
export function splitClauses(text: string): TextRange[] {
    const ranges: TextRange[] = [];
    const boundary = /[.;!?]\s+/g;
    let start = 0;
    for (const hit of text.matchAll(boundary)) {
        const end = (hit.index ?? 0) + 1; // keep the punctuation mark with its clause
        if (end > start) ranges.push({ start, end });
        start = (hit.index ?? 0) + hit[0].length;
    }
    if (start < text.length) ranges.push({ start, end: text.length });
    return ranges;
}

function statusWords(value: string): ReadonlyArray<string> {
    return STATUS_WORDS[value] ?? [value.toLowerCase()];
}

/** Does this clause read as the place `c` is printed? */
function clauseMatches(clause: string, c: ProgramConstraint, isElseBranch: boolean): boolean {
    const lower = clause.toLowerCase();
    switch (c.type) {
        case 'HAS_STATUS':
        case 'NOT_STATUS':
            return CONDITION_CUE.test(clause) && statusWords(String(c.value)).some((w) => lower.includes(w));
        case 'HEALTH_THRESHOLD': {
            const op = String(c.value).split(':')[0];
            if (op === 'GT') return ABOVE.test(clause);
            // `LT` is written either as "below ..." or, as the second half of an either/or, as
            // "otherwise ..."/"else ...". The else-branch reading is only allowed when the card also
            // carries the GT half — a lone "otherwise" on a card with one rider is not this one.
            return BELOW.test(clause) || (isElseBranch && OTHERWISE.test(clause));
        }
        case 'CARDS_PLAYED':
            return /\b(third|second|fourth|\d+(st|nd|rd|th))\b/i.test(clause) || /\bcards? you played\b/i.test(clause);
        case 'CARDS_DRAWN_TRIGGERED':
        case 'CARDS_DRAWN':
            return /\bdr[ae]w\b/i.test(clause) && CONDITION_CUE.test(clause);
        default:
            return false;
    }
}

/**
 * For each conditional action on the card, the clause its rider is printed in (or `null` when the
 * rules cannot place it — the registry test keeps that at zero for shipped cards).
 *
 * Returned in action order, parallel to `data.actions` filtered to the conditional ones.
 */
export function clauseForEachConditional(data: ProgramData): Array<{ actionIndex: number; clause: TextRange | null }> {
    const text = data.description ?? '';
    const clauses = splitClauses(text);
    const conditional = (data.actions ?? [])
        .map((a, actionIndex) => ({ a, actionIndex }))
        .filter(({ a }) => (a.conditionals ?? []).length > 0);
    const hasAboveHalf = conditional.some(({ a }) =>
        (a.conditionals ?? []).some((c) => c.type === 'HEALTH_THRESHOLD' && String(c.value).startsWith('GT')));

    return conditional.map(({ a, actionIndex }) => {
        // An action's rider is placed by its FIRST constraint; a multi-constraint rider is one clause.
        const lead = (a.conditionals ?? [])[0];
        const found = clauses.find((r) => clauseMatches(text.slice(r.start, r.end), lead, hasAboveHalf));
        return { actionIndex, clause: found ?? null };
    });
}

/**
 * The ranges to paint green: every clause whose riders are ALL known to hold.
 *
 * A clause with two riders on it (`dread_tidings`: draw 2 more AND gain Strength, both "if you are
 * Asleep") lights only when both are met; a clause with a rider the hand cannot answer (`null`) does
 * not light — unknown is not true.
 */
export function litClauses(data: ProgramData, readings: ReadonlyArray<ConditionalReading>): TextRange[] {
    if (readings.length === 0) return [];
    const metByAction = new Map(readings.map((r) => [r.actionIndex, r.met]));
    const verdictByClause = new Map<string, { range: TextRange; lit: boolean }>();
    for (const { actionIndex, clause } of clauseForEachConditional(data)) {
        if (!clause) continue;
        const key = `${clause.start}:${clause.end}`;
        const met = metByAction.get(actionIndex) === true;
        const prior = verdictByClause.get(key);
        verdictByClause.set(key, { range: clause, lit: (prior ? prior.lit : true) && met });
    }
    return [...verdictByClause.values()].filter((v) => v.lit).map((v) => v.range).sort((x, y) => x.start - y.start);
}
