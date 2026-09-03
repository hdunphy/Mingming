/**
 * What a won fight pays — ticket 12.
 *
 * The five pieces of the refit, each with the assertion that would catch it regressing: no XP in
 * the bundle, blueprint rates keyed by node kind (with the alpha's guarantee and the repeat drop),
 * scrap keyed by node kind and scaling with enemy count, the pick pool drawn from the party's
 * species, and determinism.
 *
 * **The load-bearing test in this file is `repeat fights on a re-entered node`.** Henry's amendment
 * of 2026-08-21 rules that farming is fine and a re-entered node pays FULL rewards; it is the one
 * rule a plausible future patch ("wilds pay less the third time") would quietly break, and the one
 * that leaves no trace in the type system, because the payout has no visit parameter to shrink.
 */

import { describe, it, expect } from 'vitest';
import {
    BLUEPRINT_DROP_RATE,
    SALVAGE_CHOICES_PER_FOE,
    BASE_WIN_SCRAP,
    ELITE_WIN_SCRAP,
    SCRAP_PER_EXTRA_ENEMY,
    scrapForWin,
    getScrapYield,
    isRewardable,
    rewardCardPool,
    rollDraftRounds,
    rollDropTable,
    blueprintRateFor,
} from './RewardSystem';
import { ProgramRegistry } from './data/programRegistry';
import { getDeckForOS, MingmingRegistry } from './data/mingmingRegistry';
import { encounterSeed } from './run/encounter';
import type { IRegionNode, IRunState } from './runTypes';
import type { Element, IBattleEntity } from './types';
import { ELEMENTS } from './types';

function makeDeadEntity(id: string, defId: string, name: string, element: Element = 'Fire'): IBattleEntity {
    return {
        id, name,
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 15, defense: 5,
        maxEnergy: 10, cardDraw: 1,
        currentHp: 0, // DEAD
        currentEnergy: 0,
        primaryElement: element,
        statusEffects: [],
        definitionId: defId,
        tempHp: 0, speed: 10,
        daemons: []
    };
}

function makeAliveEntity(id: string, defId: string, name: string): IBattleEntity {
    return { ...makeDeadEntity(id, defId, name), currentHp: 50 };
}

/** A party as `rewardCardPool` wants it — species + firmware, which `IBattleEntity` also satisfies. */
const FENRIR_V1 = [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }];
const FENRIR_AND_KRAKEN = [
    { definitionId: 'fenrir', activeOS: 'fenrir_v1' },
    { definitionId: 'kraken', activeOS: 'kraken_v1' },
];

/** N dead enemies of one species, which is what a symmetric wild fields. */
function deadParty(count: number, defId = 'fyrbot', element: Element = 'Fire'): IBattleEntity[] {
    return Array.from({ length: count }, (_, i) => makeDeadEntity(`e${i}`, defId, `Foe ${i}`, element));
}

describe('RewardSystem', () => {
    describe('the bundle has no XP (ticket 12, piece 1)', () => {
        it('does not carry a totalXP field at all', () => {
            const bundle = rollDropTable({
                defeated: deadParty(3),
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: 'no-xp',
            });

            // Not `toBe(0)` — ticket 21 already made it structurally zero and that was the state
            // this ticket was asked to end. The field must be absent, so that nothing can read it
            // and nothing can start writing it again.
            expect('totalXP' in bundle).toBe(false);
            expect(Object.keys(bundle).sort()).toEqual(['blueprints', 'cardChoices', 'cards', 'scraps']);
        });

        it('pays scrap, one pick per defeated enemy, and possibly a blueprint — and nothing else', () => {
            const bundle = rollDropTable({
                defeated: deadParty(3),
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: 'done-when',
            });

            expect(bundle.scraps).toBeGreaterThan(0);
            expect(bundle.cardChoices).toHaveLength(3);
            for (const choice of bundle.cardChoices) {
                expect(choice.options).toHaveLength(SALVAGE_CHOICES_PER_FOE);
            }
            expect(Array.isArray(bundle.blueprints)).toBe(true);
        });

        it('skips enemies that are still standing', () => {
            const bundle = rollDropTable({
                defeated: [makeDeadEntity('e1', 'fyrbot', 'Dead'), makeAliveEntity('e2', 'fyrbot', 'Alive')],
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: '42',
            });
            expect(bundle.cardChoices).toHaveLength(1);
        });
    });

    describe('blueprint drops by node kind (ticket 12, piece 2)', () => {
        /** Fraction of single-enemy fights that dropped a blueprint, over `n` seeds. */
        function dropRate(nodeKind: Parameters<typeof rollDropTable>[0]['nodeKind'], n = 600): number {
            let drops = 0;
            for (let i = 0; i < n; i++) {
                const bundle = rollDropTable({
                    defeated: [makeDeadEntity('e1', 'fenrir', 'Foe')],
                    nodeKind,
                    party: FENRIR_V1,
                    seed: `bp-${nodeKind}-${i}`,
                });
                if (bundle.blueprints.length > 0) drops++;
            }
            return drops / n;
        }

        it('an alpha ALWAYS drops one (ticket 07: "guards a guaranteed blueprint")', () => {
            for (let i = 0; i < 100; i++) {
                const bundle = rollDropTable({
                    defeated: [makeDeadEntity('e1', 'kraken', 'Alpha')],
                    nodeKind: 'alpha',
                    party: FENRIR_V1,
                    seed: `alpha-${i}`,
                });
                expect(bundle.blueprints).toEqual(['kraken']);
            }
            expect(BLUEPRINT_DROP_RATE.alpha).toBe(1);
        });

        it('drops at roughly the rate the table states for every fight kind', () => {
            // Wide bands on purpose: these assert that the table is what the roll consults, not
            // that a proposal survived a ratification. 600 samples put the standard error near
            // 0.02, so ±0.08 is several sigma and none of this flakes.
            //
            // **Against `blueprintRateFor`, not the bare table** (Henry, 2026-09-01): `dropRate`
            // fights ONE body, and a one-body fight is a solo fight, which the ruling pays 10 points
            // above the table. Comparing to the raw number here would be asserting that the solo
            // bonus does not exist — this file's own sampler is the shape the bonus is for.
            for (const kind of ['wild', 'ambush', 'elite', 'gym'] as const) {
                const expected = blueprintRateFor(kind, 1);
                const observed = dropRate(kind);
                expect(Math.abs(observed - expected),
                    `${kind}: observed ${observed}, solo rate is ${expected} (table ${BLUEPRINT_DROP_RATE[kind]})`)
                    .toBeLessThan(0.08);
            }
        });

        it('drops the species you defeated, not something else', () => {
            const bundle = rollDropTable({
                defeated: [makeDeadEntity('e1', 'jormungandr', 'Alpha')],
                nodeKind: 'alpha',
                party: FENRIR_V1,
                seed: 'species',
            });
            expect(bundle.blueprints).toEqual(['jormungandr']);
        });

        it('a species already owned can drop AGAIN — the roll cannot see the ranch', () => {
            // The re-roll grind, in the form the code can actually assert: `rollDropTable` takes no
            // ranch, no blueprint counts and no "already owned" list, so there is nowhere for a
            // duplicate to be suppressed. Two alphas of the same species in one fight pay two
            // blueprints of it, and `gameSlice.addBlueprint` stacks them (ticket 20 —
            // `gameSlice.rewardActions.test.ts` holds that half).
            const bundle = rollDropTable({
                defeated: [
                    makeDeadEntity('e1', 'kraken', 'Alpha A'),
                    makeDeadEntity('e2', 'kraken', 'Alpha B'),
                ],
                nodeKind: 'alpha',
                party: FENRIR_V1,
                seed: 'duplicate-species',
            });
            expect(bundle.blueprints).toEqual(['kraken', 'kraken']);
        });

        it('pays no blueprint on a kind that is not a fight', () => {
            for (const kind of ['marketplace', 'workshop', 'event'] as const) {
                for (let i = 0; i < 25; i++) {
                    const bundle = rollDropTable({
                        defeated: [makeDeadEntity('e1', 'fenrir', 'Foe')],
                        nodeKind: kind,
                        party: FENRIR_V1,
                        seed: `non-fight-${kind}-${i}`,
                    });
                    expect(bundle.blueprints).toEqual([]);
                }
            }
        });
    });

    describe('scrap by node kind, scaling with enemy count (ticket 12, piece 3)', () => {
        it('scales with the number of defeated enemies', () => {
            // Party size IS enemy count for an ordinary wild (`enemyPartySize`), so this is the
            // ticket's "a 3v3 should pay meaningfully more than a solo one" — and it holds per
            // seed, not just on average, because each extra corpse appends a positive roll.
            const solo = rollDropTable({ defeated: deadParty(1), nodeKind: 'wild', party: FENRIR_V1, seed: 'scale' });
            const duo = rollDropTable({ defeated: deadParty(2), nodeKind: 'wild', party: FENRIR_V1, seed: 'scale' });
            const trio = rollDropTable({ defeated: deadParty(3), nodeKind: 'wild', party: FENRIR_V1, seed: 'scale' });

            expect(duo.scraps).toBeGreaterThan(solo.scraps);
            expect(trio.scraps).toBeGreaterThan(duo.scraps);
            // Ticket 57 made the step exact rather than statistical: `10 + 5 per extra body`.
            expect(solo.scraps).toBe(BASE_WIN_SCRAP);
            expect(duo.scraps).toBe(BASE_WIN_SCRAP + SCRAP_PER_EXTRA_ENEMY);
            expect(trio.scraps).toBe(BASE_WIN_SCRAP + 2 * SCRAP_PER_EXTRA_ENEMY);
        });

        it('pays per FIGHT and flat, not per body and rolled — ticket 56/57', () => {
            // The shape change, asserted directly. Ticket 12 rolled a band per corpse (a 3v3 wild
            // paid 8-14 three times, ~450-500 a run); Henry replaced that scale wholesale. Scrap is
            // now a number the player can predict before swinging, which is what makes a shop price
            // a plan rather than a hope.
            for (let i = 0; i < 25; i++) {
                const bundle = rollDropTable({
                    defeated: deadParty(3),
                    nodeKind: 'wild',
                    party: FENRIR_V1,
                    seed: `flat-${i}`,
                });
                expect(bundle.scraps).toBe(20);
            }
        });

        it('matches the ruled table at every size and kind', () => {
            expect(scrapForWin('wild', 1)).toBe(10);
            expect(scrapForWin('wild', 2)).toBe(15);
            expect(scrapForWin('wild', 3)).toBe(20);
            // An elite is flat, and independent of how many bodies it fields.
            expect(scrapForWin('elite', 1)).toBe(ELITE_WIN_SCRAP);
            expect(scrapForWin('elite', 3)).toBe(ELITE_WIN_SCRAP);
            // An ambush is a wild with one more body, so it scales by the same rule.
            expect(scrapForWin('ambush', 4)).toBe(25);
            // Non-fight kinds pay nothing, and neither does a fight nobody won.
            expect(scrapForWin('marketplace', 3)).toBe(0);
            expect(scrapForWin('wild', 0)).toBe(0);
        });

        it('pays an elite strictly more than a wild of the same size', () => {
            const wild = rollDropTable({ defeated: deadParty(3), nodeKind: 'wild', party: FENRIR_V1, seed: 'vs' });
            const elite = rollDropTable({ defeated: deadParty(3), nodeKind: 'elite', party: FENRIR_V1, seed: 'vs' });
            expect(elite.scraps).toBeGreaterThan(wild.scraps);
        });

        it('MEASURES one run\u2019s income at 260 spendable, further ABOVE ticket 56\u2019s ~150-180 estimate', () => {
            /*
             * Ticket 57's Done-when asks for this arithmetic re-measured. It does not come out where
             * ticket 56 estimated, and the honest thing is to pin what the ruled table actually pays
             * rather than assert a band it does not hit.
             *
             * The run modelled is `exploration-map.md`'s: 8-10 fights plus the gauntlet, with the
             * party growing 1 -> 2 -> 3 through the two workshops, so the early fights are genuinely
             * smaller (enemy count mirrors party size — `encounter.enemyPartySize`).
             *
             * **Re-measured after Henry's 2026-08-24 elite raise** (`ELITE_WIN_SCRAP` 30 -> 45). That
             * raise moved the run deliberately FURTHER from ticket 56's band rather than back into
             * it: the same playtest had a removal (20) and a recruit (25) competing for a purse that
             * covered neither in time, so the band this test reports is expected to keep drifting up.
             */
            const wilds = 3 * scrapForWin('wild', 1) + 3 * scrapForWin('wild', 2) + 2 * scrapForWin('wild', 3);
            const elites = 3 * scrapForWin('elite', 3);
            const pocket = scrapForWin('alpha', 1);
            const gauntlet = 3 * scrapForWin('gym', 3);

            // 30 + 45 + 40 = 115 from wilds, 3 x 45 = 135 from the three biome exits, 10 from a
            // pocket alpha. The wilds did not move: the whole +45 over the old 215 is the elites.
            expect(wilds).toBe(115);
            expect(elites).toBe(135);
            expect(pocket).toBe(10);
            expect(gauntlet).toBe(60);

            // SPENDABLE income is what a shop price should be sized against, and the gauntlet's is
            // not spendable — the run ends when it does, and there is no shop after it. A run also
            // now OPENS holding `createRun.STARTING_SCRAP`, which is a grant rather than income and
            // so is not counted here; the purse the shops actually see is 20 above this.
            expect(wilds + elites + pocket).toBe(260);
            expect(wilds + elites + pocket + gauntlet).toBe(320);

            /*
             * 260 against an estimate of 150-180. The gap is the three elites: at a flat 45 they are
             * 135 of it, and — only since the raise — genuinely more than all eight wilds put
             * together, which is what the old 30 was always described as being and never was
             * (90 < 115). Whether that is wrong depends on what ticket 56 was picturing, which is
             * Henry's to say — this file reports it rather than quietly retuning a ruled number.
             */
            expect(elites).toBeGreaterThan(wilds);
        });

        it('pays nothing on a kind that is not a fight', () => {
            const bundle = rollDropTable({
                defeated: deadParty(3),
                nodeKind: 'event',
                party: FENRIR_V1,
                seed: 'event-scrap',
            });
            expect(bundle.scraps).toBe(0);
        });
    });

    describe('repeat fights on a re-entered node pay FULL rewards (Henry, 2026-08-21)', () => {
        /**
         * The seed a node hands the reward roll on its Nth entry — the real derivation
         * (`encounterSeed` = run seed + node id + visit count), because the whole hazard is that a
         * future patch reads the visit count for a payout instead of only for the re-roll.
         */
        const seedForVisit = (runSeed: string, visit: number): string => encounterSeed(
            { seed: runSeed } as IRunState,
            { id: 'node_wild_2', visited: visit } as IRegionNode,
        );

        it('pays the same on the sixth visit as on the first', () => {
            const meanFor = (visit: number) => {
                let total = 0;
                const samples = 200;
                for (let i = 0; i < samples; i++) {
                    total += rollDropTable({
                        defeated: deadParty(3),
                        nodeKind: 'wild',
                        party: FENRIR_V1,
                        seed: seedForVisit(`farm-run-${i}`, visit),
                    }).scraps;
                }
                return total / samples;
            };

            const first = meanFor(1);
            for (const visit of [2, 3, 6, 12]) {
                // A 3-body wild averages ~33. Any falloff worth shipping would move this by far
                // more than 3, and no honest re-roll can.
                expect(Math.abs(meanFor(visit) - first), `visit ${visit} paid differently`).toBeLessThan(3);
            }
        });

        it('still drops blueprints at the full rate on a re-entered node', () => {
            const rateFor = (visit: number) => {
                let drops = 0;
                const samples = 400;
                for (let i = 0; i < samples; i++) {
                    const bundle = rollDropTable({
                        defeated: [makeDeadEntity('e1', 'fenrir', 'Foe')],
                        nodeKind: 'wild',
                        party: FENRIR_V1,
                        seed: seedForVisit(`farm-bp-${i}`, visit),
                    });
                    if (bundle.blueprints.length > 0) drops++;
                }
                return drops / samples;
            };
            // One body, so the solo rate (2026-09-01) is the one to beat — the point of the case is
            // that visit 7 pays what visit 1 pays, not what any particular number is.
            expect(Math.abs(rateFor(7) - blueprintRateFor('wild', 1))).toBeLessThan(0.08);
        });

        it('still offers a full pick-1-of-3 per enemy on a re-entered node', () => {
            const tenth = rollDropTable({
                defeated: deadParty(3),
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: seedForVisit('farm-picks', 10),
            });
            expect(tenth.cardChoices).toHaveLength(3);
            for (const choice of tenth.cardChoices) {
                expect(choice.options).toHaveLength(SALVAGE_CHOICES_PER_FOE);
            }
        });

        it('takes no visit count at all — there is nowhere to put a falloff', () => {
            // Structural, and the strongest form of the ruling available: the bundle is a pure
            // function of (defeated, nodeKind, party, seed). Two entries that happened to roll the
            // same seed are the same fight and pay the same, which is only true because nothing
            // else is an input.
            const a = rollDropTable({ defeated: deadParty(2), nodeKind: 'wild', party: FENRIR_V1, seed: 'same' });
            const b = rollDropTable({ defeated: deadParty(2), nodeKind: 'wild', party: FENRIR_V1, seed: 'same' });
            expect(a).toEqual(b);
        });
    });

    describe('the pick pool is the party (ticket 12, piece 4)', () => {
        it('draws only from the party’s ELEMENTS — ruled by Henry, 2026-08-28', () => {
            /*
             * This test used to pin the pool to fenrir_v1's own deck LIST. Henry widened it:
             * *"the main 5 should be any card from your element not just your deck"*, asked about
             * the marketplace and ruled to apply to drops as well, because the two share this
             * function on purpose. So the claim moves down a level — from species to element — and
             * what it still forbids is the thing that matters: an offer of an element nobody in your
             * party runs.
             */
            const allowed = new Set(rewardCardPool(FENRIR_V1));
            expect(allowed.size, 'the element pool should be much wider than one deck list')
                .toBeGreaterThan(getDeckForOS('fenrir', 'fenrir_v1').length);
            for (let i = 0; i < 40; i++) {
                const bundle = rollDropTable({
                    defeated: deadParty(3, 'jormungandr', 'Water'),
                    nodeKind: 'wild',
                    party: FENRIR_V1,
                    seed: `pool-${i}`,
                });
                for (const choice of bundle.cardChoices) {
                    for (const option of choice.options) {
                        expect(allowed, `${option.dataId} is not a Fire/neutral card`).toContain(option.dataId);
                        expect(['Fire', 'None']).toContain(ProgramRegistry[option.dataId].element);
                    }
                }
            }
        });

        it('ignores the defeated enemy element — the pool is the party, not the corpse', () => {
            // The pre-ticket-12 rule would have offered Water/None cards here. fenrir_v1 is a Fire
            // list, and that is what comes out.
            const bundle = rollDropTable({
                defeated: deadParty(1, 'jormungandr', 'Water'),
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: 'element-blind',
            });
            for (const option of bundle.cardChoices[0].options) {
                expect(['Fire', 'None']).toContain(ProgramRegistry[option.dataId].element);
            }
        });

        /**
         * TICKET 136i moved the fixture off fenrir_v1, and the reason is worth reading rather
         * than the diff: **fenrir_v1's rebuilt deck has five DISTINCT cards and all five are in
         * its start kit** (nine slots, four of them second copies). So it has no untagged half
         * at all, and this test - whose whole subject is the untagged half - had nothing left to
         * assert on it. The old `toBeGreaterThan(0)` guard is what caught that, which is the
         * guard doing its job.
         *
         * kraken_v1 carries the shape this test needs (`crushing_depths` is in the deck and not
         * the kit), so the assertion is unchanged and only its subject moved.
         *
         * FLAGGED FOR DESIGN, not fixed here: ticket 61's model is "payoff + 4 enablers, and the
         * run builds back toward the tuned deck". For fenrir_v1 the tuned deck now IS the kit,
         * doubled, so there is nothing for a run to draft back toward. That is a deck-design
         * call for the species pass, not something a test should paper over.
         */
        it("includes a species' UNTAGGED kit cards while it is in the party (ticket 08)", () => {
            const pool = rewardCardPool(FENRIR_AND_KRAKEN);
            const kit = new Set(MingmingRegistry['kraken'].startKits!['kraken_v1']);
            const untagged = getDeckForOS('kraken', 'kraken_v1').filter((id) => !kit.has(id));

            expect(untagged.length, 'fixture assumes kraken_v1 has cards outside its start kit')
                .toBeGreaterThan(0);
            for (const id of untagged) {
                expect(pool, `${id} is the half of the deck the run is supposed to draft back`)
                    .toContain(id);
            }
            // And the tagged half is in there too — a kit card can drop as a second copy.
            for (const id of kit) expect(pool).toContain(id);
        });

        it('unions every party member’s element, and only those elements', () => {
            const pool = rewardCardPool(FENRIR_AND_KRAKEN);

            // Both members' own deck lists are still in there — widening a pool cannot lose cards.
            for (const id of getDeckForOS('fenrir', 'fenrir_v1')) expect(pool).toContain(id);
            for (const id of getDeckForOS('kraken', 'kraken_v1')) expect(pool).toContain(id);

            // And nothing outside Fire, Water and neutral, which is what keeps recruiting a
            // decision: who you field still decides what you can draft, one level up from the card.
            for (const id of pool) {
                expect(['Fire', 'Water', 'None'], `${id} is off-element`)
                    .toContain(ProgramRegistry[id].element);
            }
        });

        it('offers cards from OUTSIDE the party’s own decks — the point of the ruling', () => {
            // The old rule made a solo party's pool five cards, which is why the shop felt like the
            // same shelf every visit. The widening is the deliverable, so it is asserted directly
            // rather than left implied by the exclusions above.
            const pool = rewardCardPool([{ definitionId: 'kraken', activeOS: 'kraken_v1' }]);
            const ownDeck = new Set(getDeckForOS('kraken', 'kraken_v1'));
            const beyond = pool.filter((id) => !ownDeck.has(id));

            expect(beyond.length, 'the pool should reach past the party’s own list').toBeGreaterThan(10);
            for (const id of beyond) expect(['Water', 'None']).toContain(ProgramRegistry[id].element);
        });

        it('never offers CALIBRATION content, which the element rule would otherwise expose', () => {
            /*
             * The control species is the balance corpus's deliberate floor and is not playable, and
             * its six `baseline_*` cards are element `None` — so they are in EVERY element's pool.
             * Under the old species rule they were unreachable; under this one they would be offered
             * to every party in the game. `isRewardable` excludes them.
             */
            const calibration = getDeckForOS('control', 'control_v1');
            expect(calibration.length).toBeGreaterThan(0);
            for (const party of [FENRIR_V1, FENRIR_AND_KRAKEN]) {
                const pool = rewardCardPool(party);
                for (const id of calibration) {
                    expect(pool, `${id} is a calibration card`).not.toContain(id);
                    expect(isRewardable(id)).toBe(false);
                }
            }
        });

        it('follows the party you are FIELDING, so swapping who is deployed changes what drops', () => {
            /*
             * HENRY'S RULING, 2026-08-25 (ticket 57 item 5): *"the cards should be from the current
             * roster of mingmings. we can swap rosters mid run so we want cards to be based on the
             * current active mingmings."*
             *
             * The source was already right — `rollDropTable` is handed `battleState.playerParty`,
             * the live party — but nothing pinned the DYNAMIC half, and that is the half the bench
             * (ticket 61) makes load-bearing: benching fenrir for kraken has to stop fenrir's cards
             * being offered, immediately, with no other change. Asserted as an EXCLUSION rather
             * than an inclusion, because "kraken's cards appear" would also pass on a pool that
             * lazily unioned the whole roster.
             */
            const fielded = rewardCardPool([{ definitionId: 'kraken', activeOS: 'kraken_v1' }]);
            const benched = getDeckForOS('fenrir', 'fenrir_v1')
                .filter((id) => !getDeckForOS('kraken', 'kraken_v1').includes(id));

            expect(benched.length, 'fixture assumes fenrir has cards kraken does not')
                .toBeGreaterThan(0);
            for (const id of benched) {
                expect(fielded, `${id} belongs to a species that is not on the field`).not.toContain(id);
            }
        });

        it('dedupes for membership — a doubled card is not a doubled drop chance', () => {
            const pool = rewardCardPool(FENRIR_V1);
            expect(new Set(pool).size).toBe(pool.length);
            // fenrir_v1 doubles blood_rite; the pool still lists it once.
            expect(getDeckForOS('fenrir', 'fenrir_v1').filter((id) => id === 'blood_rite')).toHaveLength(2);
        });

        it('can offer a card the player already holds — duplicates are legal', () => {
            // Nothing is filtered against the run deck. Over many fights with a small party pool
            // the same dataId is offered again and again; that is the intended shape, not a bug.
            const counts = new Map<string, number>();
            for (let i = 0; i < 60; i++) {
                const bundle = rollDropTable({
                    defeated: deadParty(1),
                    nodeKind: 'wild',
                    party: FENRIR_V1,
                    seed: `dupe-${i}`,
                });
                for (const option of bundle.cardChoices[0].options) {
                    counts.set(option.dataId, (counts.get(option.dataId) ?? 0) + 1);
                }
            }
            expect([...counts.values()].some((n) => n > 1)).toBe(true);
        });

        it('offers three DISTINCT cards within one pick', () => {
            for (let i = 0; i < 100; i++) {
                const bundle = rollDropTable({
                    defeated: deadParty(3),
                    nodeKind: 'wild',
                    party: FENRIR_V1,
                    seed: `distinct-${i}`,
                });
                for (const choice of bundle.cardChoices) {
                    const ids = choice.options.map((o) => o.dataId);
                    expect(new Set(ids).size).toBe(ids.length);
                }
            }
        });

        it('never offers a token', () => {
            for (const element of ELEMENTS) {
                for (let i = 0; i < 10; i++) {
                    const bundle = rollDropTable({
                        defeated: deadParty(2, 'fyrbot', element),
                        nodeKind: 'wild',
                        // Empty party on purpose: this exercises the element fallback, which is the
                        // wide registry pool where the tokens live.
                        party: [],
                        seed: `token-${element}-${i}`,
                    });
                    for (const choice of bundle.cardChoices) {
                        for (const option of choice.options) {
                            const data = ProgramRegistry[option.dataId];
                            expect(data, `unknown card ${option.dataId}`).toBeDefined();
                            expect(data.isToken ?? false, `${option.dataId} is a token`).toBe(false);
                            expect(data.rarity as string).not.toBe('Token');
                        }
                    }
                }
            }
        });

        it('falls back to the element pool when the party contributes nothing', () => {
            const pool = rewardCardPool([], 'Fire');
            expect(pool.length).toBeGreaterThan(0);
            for (const id of pool) expect(['Fire', 'None']).toContain(ProgramRegistry[id].element);

            // An unknown species has no registry deck, so it contributes nothing either.
            expect(rewardCardPool([{ definitionId: 'not_a_species' }], 'Fire')).toEqual(pool);
        });

        it('respects rarity weights within the pool (statistically)', () => {
            const counts: Record<string, number> = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0 };
            for (let i = 0; i < 100; i++) {
                const bundle = rollDropTable({
                    defeated: deadParty(1),
                    nodeKind: 'wild',
                    party: [],
                    seed: `rarity-${i}`,
                });
                for (const option of bundle.cardChoices[0].options) {
                    counts[ProgramRegistry[option.dataId].rarity]++;
                }
            }
            expect(counts.Common).toBeGreaterThan(counts.Uncommon);
            expect(counts.Common).toBeGreaterThan(150);
            expect(counts.Rare + counts.Epic).toBeLessThan(counts.Common);
        });
    });

    describe('determinism', () => {
        it('same seed + same enemies + same party → an identical bundle, instance ids included', () => {
            const input = {
                defeated: deadParty(3),
                nodeKind: 'elite' as const,
                party: FENRIR_AND_KRAKEN,
                seed: 'fixed-seed-123',
            };
            // Deep equality, not a field-by-field comparison: the claimed pick keeps its
            // `instanceId` all the way into `IRunState.deck`, so a resumed run (ticket 23) must
            // mint the same card the player was shown, not just the same card *name*.
            expect(rollDropTable(input)).toEqual(rollDropTable(input));
        });

        it('different seeds produce different bundles', () => {
            const a = rollDropTable({ defeated: deadParty(3), nodeKind: 'wild', party: FENRIR_V1, seed: 'seed-a' });
            const b = rollDropTable({ defeated: deadParty(3), nodeKind: 'wild', party: FENRIR_V1, seed: 'seed-b' });
            expect(a).not.toEqual(b);
        });

        it('mints a unique instanceId for every option in a bundle', () => {
            const bundle = rollDropTable({
                defeated: deadParty(3),
                nodeKind: 'wild',
                party: FENRIR_V1,
                seed: 'unique-ids',
            });
            const ids = bundle.cardChoices.flatMap((c) => c.options.map((o) => o.instanceId));
            expect(ids).toHaveLength(9);
            expect(new Set(ids).size).toBe(9);
        });
    });

    /**
     * Ticket 12 removed the invocation from the battle path; **ticket 18 owns the gauntlet and its
     * draft**. The function stays tested so 18 inherits something working rather than a comment.
     */
    describe('rollDraftRounds (parked for ticket 18)', () => {
        it('returns 3 rounds of 3 options by default', () => {
            const rounds = rollDraftRounds('gym-seed', 'Fire');
            expect(rounds).toHaveLength(3);
            for (const round of rounds) {
                expect(round.options).toHaveLength(3);
            }
        });

        it('respects a custom round count', () => {
            expect(rollDraftRounds('gym-seed', 'Water', 5)).toHaveLength(5);
            expect(rollDraftRounds('gym-seed', 'Water', 1)).toHaveLength(1);
        });

        it('offers distinct cards within each round', () => {
            for (let i = 0; i < 50; i++) {
                const rounds = rollDraftRounds(`distinct-${i}`, 'Fire');
                for (const round of rounds) {
                    const ids = round.options.map(o => o.dataId);
                    expect(new Set(ids).size).toBe(ids.length);
                }
            }
        });

        it('is deterministic for the same seed (dataIds match across calls)', () => {
            const a = rollDraftRounds('same-seed-42', 'Nature');
            const b = rollDraftRounds('same-seed-42', 'Nature');
            expect(a.map(r => r.options.map(o => o.dataId)))
                .toEqual(b.map(r => r.options.map(o => o.dataId)));
        });

        it('never offers tokens and only offers gym-element or neutral cards', () => {
            for (const element of ELEMENTS) {
                for (let i = 0; i < 10; i++) {
                    const rounds = rollDraftRounds(`draft-${element}-${i}`, element);
                    for (const round of rounds) {
                        for (const option of round.options) {
                            const data = ProgramRegistry[option.dataId];
                            expect(data, `unknown card ${option.dataId}`).toBeDefined();
                            expect(data.isToken ?? false, `${option.dataId} is a token`).toBe(false);
                            expect(data.rarity as string, `${option.dataId} has Token rarity`).not.toBe('Token');
                            expect([element, 'None']).toContain(data.element);
                        }
                    }
                }
            }
        });

        it('weights choices toward the gym element (statistically)', () => {
            let elementMatches = 0;
            let total = 0;
            for (let i = 0; i < 100; i++) {
                const rounds = rollDraftRounds(`weight-seed-${i}`, 'Fire');
                for (const round of rounds) {
                    for (const option of round.options) {
                        total++;
                        if (ProgramRegistry[option.dataId].element === 'Fire') elementMatches++;
                    }
                }
            }
            // 70% of picks are drawn from the Fire-exclusive pool, and the mixed
            // pool contains Fire cards too — Fire should clearly dominate neutral.
            expect(total).toBe(900);
            expect(elementMatches).toBeGreaterThan(total * 0.55);
        });
    });

    /**
     * The sell side of the economy. Nothing calls it yet — ticket 13 (marketplace) is its caller —
     * and it is kept covered so 13 finds a tested price list instead of writing a second one.
     */
    describe('getScrapYield', () => {
        it('returns correct values for known rarities', () => {
            expect(getScrapYield('Common')).toBe(10);
            expect(getScrapYield('Uncommon')).toBe(25);
            expect(getScrapYield('Rare')).toBe(50);
            expect(getScrapYield('Epic')).toBe(100);
        });

        it('defaults to 10 for unknown rarity', () => {
            expect(getScrapYield('Legendary')).toBe(10);
            expect(getScrapYield()).toBe(10);
        });
    });
});
