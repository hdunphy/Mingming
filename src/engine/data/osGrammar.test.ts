/**
 * TICKET 158-r1 — THE GRAMMAR IS THE REGISTRY'S NOW, and these are the claims that makes it usable.
 *
 * `osGrammar.ts` was transcribed from `collection-v2/collection.json` by a script, so the risk here
 * is not a typo in one entry — it is a systematic slip in the transcription that reads fine and is
 * wrong everywhere. Each claim below is one of those:
 *
 *  - **the twelve are covered**, so the walker never has to guess for an EA body;
 *  - **every partner is a firmware id the registry knows**, which is the whole reason the field was
 *    moved (the design file said `'Rat v1'`, and nothing could join that to `ratatoskr_v1`);
 *  - **the tokens still describe the line they came from**, which is what stops the parser quietly
 *    dropping a currency the moment somebody writes a new separator;
 *  - **the currency vocabulary is small and shared**, because a currency only means anything if two
 *    bodies can bank the same one.
 */
import { describe, it, expect } from 'vitest';

import { OS_GRAMMAR, grammarFor, partnersInParty, type TempoKind } from './osGrammar';
import { MingmingRegistry, LAUNCH_SPECIES } from './mingmingRegistry';
import { getOSBehavior } from './firmwareRegistry';

const EA_OS: string[] = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);
const KINDS: TempoKind[] = ['zoo', 'ramp', 'control', 'keeper'];

describe('158-r1 — coverage', () => {
    it('covers exactly the EA twelve, and every one of them is real firmware', () => {
        expect(EA_OS).toHaveLength(12);
        expect(Object.keys(OS_GRAMMAR).sort()).toEqual([...EA_OS].sort());
        for (const osId of EA_OS) expect(getOSBehavior(osId), `${osId} has no firmware`).toBeDefined();
    });

    it('answers undefined for an OS with no grammar recorded, rather than an empty one', () => {
        // "No currency" and "nobody has written the currency down" are different answers, and the
        // readout says them differently. Every post-EA OS is in the second case.
        expect(grammarFor('gullinbursti_v2')).toBeUndefined();
        expect(grammarFor('not_an_os')).toBeUndefined();
    });
});

describe('158-r1 — the fields the ruling asked for', () => {
    it.each(EA_OS)('%s has currency tokens, a tempo, and both are drawn from its own line', (osId: string) => {
        const g = grammarFor(osId)!;
        expect(g.currency.length, 'no currency').toBeGreaterThan(0);
        expect(new Set(g.currency).size, 'a currency listed twice').toBe(g.currency.length);
        expect(g.tempo.length).toBeGreaterThan(0);
        for (const kind of g.tempo) expect(KINDS).toContain(kind);

        /*
         * THE TRANSCRIPTION CHECK, and the one that earns its place. The tokens are parsed FROM the
         * text, so a separator nobody anticipated ("Burn; Sharp") would silently produce one token
         * that happens to look plausible. Every token must still appear in the line it came from,
         * and every tempo kind must be a word of the tempo line.
         */
        for (const token of g.currency) expect(g.currencyText).toContain(token);
        for (const kind of g.tempo) expect(g.tempoText).toContain(kind);
    });

    it('spends a SMALL shared vocabulary of currencies, because a currency two bodies cannot share is not one', () => {
        const all = Object.values(OS_GRAMMAR).flatMap((g) => [...g.currency]);
        const distinct = new Set(all);
        // Eleven across twelve firmware. The number is pinned rather than bounded: it moving is a
        // design change (158 §2.1 names the currencies), and it should fail here and be looked at.
        expect([...distinct].sort()).toEqual([
            'Bark', 'Burn', 'Dazed', 'Energy', 'HP', 'Poison', 'Regen', 'Sharp', 'Strength', 'Weakened', 'cards',
        ]);
        /*
         * MEASURED, not assumed. Five of the eleven are banked by more than one firmware and six by
         * exactly one, and `cards` alone is banked by FOUR — which is the zoo engines (both
         * ratatoskrs, jormungandr_v1, kraken_v1) all counting the same thing. That concentration is
         * the shape 158 §3 wanted the census to show, so it is pinned here rather than described:
         * if a design pass spreads it out or piles more onto `cards`, this fails and gets read.
         */
        const shared = [...distinct].filter((c) => all.filter((x) => x === c).length > 1).sort();
        expect(shared).toEqual(['Burn', 'Dazed', 'Sharp', 'Strength', 'cards']);
        expect(all.filter((c) => c === 'cards')).toHaveLength(4);
    });
});

describe('158-r1 — partners are ids, which is the point of the move', () => {
    it('names only EA firmware, and never itself', () => {
        for (const [osId, g] of Object.entries(OS_GRAMMAR)) {
            expect(g.partners.length, `${osId} has no partners`).toBeGreaterThan(0);
            for (const p of g.partners) {
                expect(EA_OS, `${osId} -> ${p.osId}`).toContain(p.osId);
                expect(p.osId, `${osId} partners with itself`).not.toBe(osId);
                expect(p.why.length, `${osId} -> ${p.osId} has no reason`).toBeGreaterThan(0);
            }
        }
    });

    it('is NOT asserted symmetric, and the asymmetries are named rather than assumed away', () => {
        /*
         * A one-way hint is legitimate design — huldra_v1 feeds a great many decks and is fed by
         * fewer — so symmetry is not a law here. What would be a defect is an asymmetry nobody
         * noticed, so the exact set is pinned: if a design pass makes a pairing one-way, this fails
         * and somebody reads the list.
         */
        const oneWay: string[] = [];
        for (const [osId, g] of Object.entries(OS_GRAMMAR)) {
            for (const p of g.partners) {
                if (!OS_GRAMMAR[p.osId].partners.some((back) => back.osId === osId)) {
                    oneWay.push(`${osId} -> ${p.osId}`);
                }
            }
        }
        expect(oneWay.sort()).toEqual([
            'fenrir_v2 -> huldra_v1',
            'huldra_v2 -> ratatoskr_v1',
            'kraken_v1 -> skoll_v1',
            'ratatoskr_v1 -> ratatoskr_v2',
            'skoll_v2 -> jormungandr_v2',
        ]);
        // Five of thirty-seven, so the authored web is overwhelmingly mutual. The one worth an eye
        // is `ratatoskr_v1 -> ratatoskr_v2`: a species pointing at its own other firmware, unreturned.
        expect(oneWay).toHaveLength(5);
    });

    it('marks the partners that are already on the field, and nothing else', () => {
        // The readout's whole job: a hint is advice until it is a fact about the party in front of
        // you. Order follows the authored list, so the first-written hint reads first.
        const found = partnersInParty('fenrir_v1', ['huldra_v1', 'kraken_v2']);
        expect(found.map((p) => p.osId)).toEqual(['huldra_v1']);
        expect(partnersInParty('fenrir_v1', [])).toEqual([]);
        expect(partnersInParty('gullinbursti_v2', ['huldra_v1'])).toEqual([]);
    });
});
