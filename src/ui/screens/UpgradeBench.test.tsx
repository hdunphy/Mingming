/**
 * TICKET 163b — THE BENCH'S SURFACE, and the highlight that tells the player what they bought.
 *
 * `runSlice.upgrade.test.ts` proves what the verb does to the run. This proves the two things a
 * screen can get wrong on its own:
 *
 * - **What it offers.** One row per unique card, only cards in the ACTIVE DECK, only cards with a
 *   `+` authored — and nothing at all when the deck has none, with a sentence rather than an empty
 *   box. A bench that offered a card it cannot upgrade is a dead button in a shop.
 * - **What it says it costs.** The gate is free and says so; a bench is priced and greys out when
 *   the purse is short. The reducer refuses either way; this is the courtesy that stops the player
 *   finding out by clicking.
 *
 * And `describeUpgrade`, which is the answer to *"what did that buy me"* on every surface that
 * renders a full card face. Tested as a pure function rather than through a screen, because it is
 * one and because the interesting cases are printings, not pixels.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { UpgradeBench } from './UpgradeBench';
import { describeUpgrade } from './runShell';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { upgradePrice } from '../../engine/run/marketplace';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap: number): IRunState {
    const run = createRun({
        seed: 'bench-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap };
}

function render(run: IRunState, props: Partial<Parameters<typeof UpgradeBench>[0]> = {}): string {
    const store = configureStore({ reducer: { run: runReducer }, preloadedState: { run: { run } } });
    return renderToStaticMarkup(
        <Provider store={store}>
            <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" {...props} />
        </Provider>,
    );
}

const rows = (markup: string): string[] =>
    [...markup.matchAll(/<button[^>]*class="rs-row"[\s\S]*?<\/button>/g)].map(([html]) => html);

describe('163b — what the bench offers', () => {
    it('lists one row per unique upgradable card in the deck, and no others', () => {
        const run = makeRun(500);
        const expected = new Set(run.deck.filter((c) => hasUpgrade(c.dataId)).map((c) => c.dataId));
        expect(expected.size, 'the fixture deck has nothing upgradable').toBeGreaterThan(0);
        expect(rows(render(run))).toHaveLength(expected.size);
    });

    it('names the card it becomes, so the row is the before and the after', () => {
        const markup = render(makeRun(500));
        // Every row reads `Name → Name+`. The arrow is the whole explanation a row has space for.
        for (const row of rows(markup)) {
            expect(row).toMatch(/<span class="rs-rnm">[^<]+ → <b>[^<]+\+<\/b><\/span>/);
        }
    });

    it('says so in a sentence when the deck has nothing to upgrade', () => {
        // Not an empty box. A player looking at a bench with no rows should be told why.
        const run = makeRun(500);
        const markup = render({ ...run, deck: [] });
        expect(rows(markup)).toHaveLength(0);
        expect(markup).toContain('Nothing in the deck has an upgrade yet');
    });

    it('prints no card description — the workshop bay\'s standing law', () => {
        /*
         * *"A bay lists engines by NAME and COST — that is what an engine row is."* This component
         * renders at the workshop, so it obeys that law at every venue rather than being two
         * benches wearing one name. Asserted against the upgraded printings the deck can actually
         * reach, so a partial re-appearance fails too.
         */
        const run = makeRun(500);
        const markup = render(run);
        const plusText = run.deck
            .filter((c) => hasUpgrade(c.dataId))
            .map((c) => describeUpgrade(`${c.dataId}+`).map((s) => s.text).join(''))
            .filter((t) => t.length > 0);
        expect(plusText.length).toBeGreaterThan(0);
        for (const text of plusText) expect(markup).not.toContain(text);
    });
});

describe('163b — what the bench says it costs', () => {
    it('greys out every row when the purse cannot cover the cheapest upgrade', () => {
        const markup = render(makeRun(0));
        expect(rows(markup).length).toBeGreaterThan(0);
        for (const row of rows(markup)) expect(row).toContain('disabled=""');
    });

    it('charges the ruled price, and prices each row by its own card', () => {
        const run = makeRun(500);
        const markup = render(run);
        for (const dataId of new Set(run.deck.map((c) => c.dataId))) {
            if (!hasUpgrade(dataId)) continue;
            expect(markup).toContain(`−${upgradePrice(dataId)} `);
        }
    });

    it('is FREE at the gate, and says the word rather than a zero', () => {
        const markup = render(makeRun(0), { free: true, heading: 'THE GATE' });
        expect(markup).toContain('FREE');
        expect(markup).toContain('(free, once)');
        // And free means clickable on an empty purse, which is the whole point of the gate.
        for (const row of rows(markup)) expect(row).not.toContain('disabled=""');
    });

    it('closes the bench once this visit\'s allowance is spent', () => {
        const run = { ...makeRun(500), upgradesTaken: ['n1:1'] };
        const markup = render(run);
        for (const row of rows(markup)) expect(row).toContain('disabled=""');
        expect(markup).toContain('Already used this visit');
    });
});

describe('163b — describeUpgrade, the "what did that buy me" highlight', () => {
    const marked = (dataId: string): string[] =>
        describeUpgrade(dataId).filter((s) => s.changed).map((s) => s.text);
    const whole = (dataId: string): string =>
        describeUpgrade(dataId).map((s) => s.text).join('');

    it('marks the number that moved and nothing else', () => {
        // Venom Fang 30 -> 40. One number in the printing, one mark.
        expect(marked('venom_fang+')).toEqual(['40']);
    });

    it('leaves an unchanged number alone when a WORD is what moved', () => {
        // Flare Burst: "15 power, twice" -> "15 power, three times". The 15 did not move, and a
        // set-difference diff would have marked it because "three" is new.
        expect(marked('flare_burst+')).toEqual([]);
        expect(whole('flare_burst+')).toContain('three times');
    });

    it('marks a number the base printing did not have at all', () => {
        // Mend+: "Heal an ally with 20 power, AND YOURSELF WITH 10." The 10 is a new clause.
        expect(marked('mend+')).toContain('10');
    });

    it('marks only the half that grew on a card that prints a number twice', () => {
        // Blood Rite: the base swing grows 15 -> 20 and the heal 40 -> 50; the conditional rider stays 15.
        expect(marked('blood_rite+')).toEqual(['20', '50']);
    });

    it('returns a base card unchanged, as one plain segment', () => {
        // Which is what keeps this a highlight for ninety-eight cards rather than a DOM change
        // for all of them — see the render in `CardChassis`.
        const segments = describeUpgrade('venom_fang');
        expect(segments).toHaveLength(1);
        expect(segments[0].changed).toBe(false);
    });

    it('survives a card that does not exist', () => {
        expect(whole('not_a_real_card')).toBe('');
    });
});
