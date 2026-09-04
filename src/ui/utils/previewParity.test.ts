import { describe, it, expect } from 'vitest';

import { computeDamagePreview } from './damagePreview';
import { battleReducer } from '../../engine/battleReducer';
import { GetProgramData } from '../../engine/data/programRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { BALANCE_SPECIES, matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleState, IBattleEntity, ProgramData, StatusType } from '../../engine/types';

/**
 * TICKET 104 - THE PREVIEW PARITY SUITE.
 *
 * Henry's playtest round 3 broke the preview three independent ways in one night: `blood_rite`
 * previewed 4 and dealt 5+5 (a conditional branch), `deep_vein` previewed 9 and dealt 36 (a
 * firmware multiplier), and multi-hit cards previewed a single hit. His summary: *"The previews
 * are broken almost everywhere... hard to play when you don't have all the right information."*
 *
 * The ticket's instruction was a parity SUITE rather than three more patches, because the preview
 * had drifted from the executor once per mechanic and would do it again. The first run of this
 * sweep found **52 mismatches across 13 cards** in five classes: multi-hit, consume-scaling,
 * self-aimed attacks previewed as damage to the enemy, conditional branches, and firmware bonuses.
 *
 * The fix was to stop re-deriving: `computeDamagePreview` now plays the card through the real
 * reducer on a throwaway state. This suite is what keeps it honest, and it is deliberately blunt -
 * it does not know or care HOW the preview arrives at its number, only that the number matches
 * what the target's HP actually does.
 *
 * It is fast (about a second) because it reuses one built scenario per species and applies the
 * sampled states on top, so it belongs in the standing unit gates rather than the balance suite.
 */

const withStatus = (e: IBattleEntity, type: StatusType, stacks: number): IBattleEntity => ({
    ...e,
    statusEffects: [
        ...e.statusEffects.filter(s => s.type !== type),
        { type, stacks, duration: -1 } as unknown as IBattleEntity['statusEffects'][number],
    ],
});

/**
 * The sampled states. Each one switches on a class of mechanic that the preview used to be blind
 * to - without them most scaling cards resolve to zero damage and get skipped, which would let the
 * suite pass by not looking.
 */
const SAMPLES: ReadonlyArray<{ name: string; apply: (s: IBattleState) => IBattleState }> = [
    { name: 'fresh', apply: s => s },
    {
        // Below the 50% line - the conditional branch `blood_rite` and `berserk_rush` read, and
        // the MISSING_HP firmware bonus on fenrir's `ragnarok_edge`.
        name: 'hurt',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) =>
                i === 0 ? { ...e, currentHp: Math.floor(e.maxHp * 0.3) } : e),
        }),
    },
    {
        // Duality piles on both sides - +1 power per stack since ticket 102.
        name: 'piles',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) => i === 0 ? withStatus(e, 'Strengthened', 6) : e),
            enemyParty: s.enemyParty.map((e, i) => i === 0 ? withStatus(e, 'Dazed', 4) : e),
        }),
    },
    { name: 'midturn', apply: s => ({ ...s, cardsPlayedThisTurn: 2, lastEnergySpent: 2 } as IBattleState) },
    {
        name: 'hoard',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) =>
                i === 0 ? withStatus({ ...e, currentEnergy: e.maxEnergy }, 'Energized', 4) : e),
        }),
    },
    {
        // The event-count scalers: CARDS_DRAWN_TRIGGERED, CARDS_DISCARDED, ENERGY_SPENT.
        name: 'counters',
        apply: s => ({
            ...s,
            cardsDrawnThisTurn: 3,
            nonNaturalCardsDrawnThisTurn: 3,
            cardsDiscardedThisTurn: 3,
            lastEnergySpent: 2,
        } as IBattleState),
    },
    {
        // Statuses ON THE TARGET: DAZED_STACKS, DISTINCT_STATUS, BURN_TIMES_ENERGY, STATUS_COUNT.
        name: 'loaded',
        apply: s => ({
            ...s,
            lastEnergySpent: 2,
            enemyParty: s.enemyParty.map((e, i) => i === 0
                ? withStatus(withStatus(withStatus(withStatus(e, 'Dazed', 4), 'Burn', 2), 'Poison', 3), 'Weakened', 2)
                : e),
        } as IBattleState),
    },
    {
        // BARKSHIELD_STACKS reads the CASTER's shield.
        name: 'shielded',
        apply: s => ({
            ...s,
            playerParty: s.playerParty.map((e, i) => i === 0 ? withStatus(e, 'BarkShield', 8) : e),
        }),
    },
    {
        /*
         * THE TARGET is shielded — added 2026-08-24, and the sample this suite was missing.
         *
         * `shielded` above puts BarkShield on the CASTER, because the scaling that reads it is
         * caster-side. Nothing sampled a shielded *target*, which is precisely where the old
         * HP-delta preview was blind: BarkShield absorbs before HP moves, so a fully absorbed hit
         * measured as zero and the card face showed no number at all. Henry hit it in a playtest;
         * this is the state that would have caught it.
         *
         * 40% rather than 8% so it actually eats a whole ordinary hit on most species.
         */
        name: 'target-shielded',
        apply: s => ({
            ...s,
            enemyParty: s.enemyParty.map((e, i) => i === 0 ? withStatus(e, 'BarkShield', 40) : e),
        }),
    },
];

/** HP plus shield - absorbed damage is still damage the player watches happen. */
const pool = (s: IBattleState, id: string): number => {
    const e = s.playerParty.find(x => x.id === id) ?? s.enemyParty.find(x => x.id === id);
    return (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
};

interface Mismatch {
    card: string; species: string; sample: string;
    field: 'damage' | 'hpDamage' | 'absorbed' | 'ledger-adds-up';
    preview: number; actual: number;
}

interface SweepResult {
    mismatches: Mismatch[];
    checked: number;
    cards: Set<string>;
    leaks: string[];
    /** How many checks ran against a target that actually had a shield up. */
    absorbedChecks: number;
}

function sweep(): SweepResult {
    const mismatches: Mismatch[] = [];
    const cards = new Set<string>();
    const leaks: string[] = [];
    let checked = 0;
    let absorbedChecks = 0;

    for (const species of BALANCE_SPECIES) {
        const entry = MingmingRegistry[species];
        const opponent = species === 'control' ? 'ymir' : 'control';
        const opponentOS = species === 'control' ? 'ymir_v1' : 'control_v1';
        const deckIds = [...new Set(entry.availableOS.flatMap(
            (o: string) => (entry.decks as Record<string, string[]>)[o] ?? []))];

        // ONE scenario per species; the samples are applied on top. Building one per card per
        // sample is what made the first version of this slow enough to belong in the balance suite.
        const setup = matchupScenario({
            player: species, enemy: opponent,
            playerOS: entry.availableOS[0], enemyOS: opponentOS,
            seed: `parity:${species}`,
        });
        const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
        const me = base.playerParty[0];
        const them = base.enemyParty[0];
        if (!me || !them) continue;

        for (const cardId of deckIds) {
            let data: ProgramData;
            try { data = GetProgramData(cardId); } catch { continue; }
            if (!data.actions?.some(a => a.type === 'ATTACK')) continue;

            for (const sample of SAMPLES) {
                let st = {
                    ...base,
                    activeSide: 'PLAYER',
                    playerParty: base.playerParty.map((e, i) =>
                        i === 0 ? { ...e, currentEnergy: Math.max(e.maxEnergy, 4) } : e),
                    playerDeck: {
                        ...base.playerDeck,
                        hand: [{ id: 'parity_card', dataId: cardId, currentCost: 0, isPlayable: true }],
                    },
                } as IBattleState;
                st = sample.apply(st);

                // PURITY. The preview runs the real reducer now, so the thing that would turn
                // this fix into a far worse bug is the reducer leaving a mark on the caller's
                // state - a hover silently changing the game. Snapshot before, compare after.
                const snapshot = JSON.stringify(st);
                const preview = computeDamagePreview(st, me.id, 'parity_card', them.id);
                if (JSON.stringify(st) !== snapshot) leaks.push(`${cardId} (${species}, ${sample.name})`);
                // A zero preview means "this card costs the target no HP in this state" - a pure
                // buff, an empty consume pile, a scaler that has nothing to read. Nothing to check.
                if (preview.damage <= 0) continue;

                const before = pool(st, them.id);
                const after = battleReducer(st, {
                    type: 'PLAY_PROGRAM',
                    payload: { sourceId: me.id, targetId: them.id, programId: 'parity_card' },
                });
                if (after === st) continue;

                checked++;
                cards.add(cardId);

                /*
                 * WHAT PARITY MEANS SINCE 2026-08-24.
                 *
                 * It used to mean one thing: preview number === HP the target lost. That was
                 * checkable and it was also the bug — the preview could only report what HP did,
                 * so a lethal blow and a shielded hit both under-read, correctly, forever.
                 *
                 * The preview now reports the engine's own `raw`, so parity is checked against the
                 * REAL play's ledger, field by field. This is strictly stronger: the old assertion
                 * survives as `hpDamage`, and two more join it.
                 */
                const realHits = (after.damageLedger ?? []).filter(h => h.targetId === them.id);
                const sum = (pick: (h: (typeof realHits)[number]) => number) =>
                    realHits.reduce((total, h) => total + pick(h), 0);
                const parity = (field: Mismatch['field'], previewed: number, actual: number): void => {
                    if (previewed !== actual) {
                        mismatches.push({ card: cardId, species, sample: sample.name, field, preview: previewed, actual });
                    }
                };

                parity('damage', preview.damage, sum(h => h.raw));
                parity('absorbed', preview.absorbed, sum(h => h.absorbed));
                parity('hpDamage', preview.hpDamage, sum(h => h.applied));
                // The old assertion, unchanged in meaning: what the HP pool did. Held against the
                // ledger's own `applied` so a ledger that lies about HP cannot pass by agreeing
                // with a preview that reads it.
                parity('ledger-adds-up', sum(h => h.applied), before - pool(after, them.id));
                if (preview.absorbed > 0) absorbedChecks++;
            }
        }
    }
    return { mismatches, checked, cards, leaks, absorbedChecks };
}

describe('preview parity (ticket 104)', () => {
    const result = sweep();

    it('the hover preview equals what the engine records, field by field, for every attack card', () => {
        const report = result.mismatches
            .map(m => `  ${m.card} (${m.species}, ${m.sample}) ${m.field}: preview ${m.preview}, actual ${m.actual}`)
            .join('\n');
        expect(result.mismatches, `\n${result.mismatches.length} preview mismatches:\n${report}\n`).toEqual([]);
    });

    it('checked hits that a shield actually ate — the absorbed field cannot pass by never firing', () => {
        // Without this floor the `target-shielded` sample could quietly stop shielding anything
        // (a renamed status, a changed stack unit) and every `absorbed` comparison would pass at
        // 0 === 0, which is exactly how the old suite missed the shielded-target case for months.
        expect(result.absorbedChecks).toBeGreaterThan(20);
    });

    it('computing a preview does not touch the caller\'s state', () => {
        expect(result.leaks, `\npreviewing these mutated the state they were given:\n  ${result.leaks.join('\n  ')}\n`)
            .toEqual([]);
    });

    it('actually looked at something - the suite cannot pass by skipping', () => {
        // Floors, not exact counts: adding cards or decks should not break this, but gutting the
        // sampled states or silently zeroing every preview should.
        expect(result.checked).toBeGreaterThan(600);
        expect(result.cards.size).toBeGreaterThan(40);
    });
});
