/**
 * TICKET 163a — THE `+` REGISTRY, held to the three things that make it safe to ship early.
 *
 * The upgraded cards are in the registry before there is any way to get one. That is the shape of
 * the row (163 §4: the `+` registry lands first, the workshop that spends them is 163b), and it
 * means the usual safety net — "a wrong card shows up in a playtest" — is not under this pass. So
 * the net is here instead, and it is three claims:
 *
 *   1. **THE TABLE IS THE REGISTRY.** Every card in `upgrades.json` has exactly one `+`, and the
 *      `+`'s printed text is the `plus` line Henry ruled. If the design table and the registry
 *      ever disagree, the number Henry approved is not the number the game plays.
 *   2. **AN UPGRADE NEVER CHANGES A CARD'S SHAPE** (163 §1). Same cost, element, category, width,
 *      side and exhaust. A `+` that turns an enabler into a payoff is a NEW CARD, and this is what
 *      says so before it ships as an upgrade.
 *   3. **NOTHING CAN REACH ONE.** Not a reward, not a shop slot, not a kit, not a generated enemy
 *      deck, not the codex denominator. Ninety-eight cards strictly stronger than the pool would
 *      be the single largest balance change in the game's history if one leaked.
 *
 * `descriptionData.test.ts` already holds every `+` to the rule that a printed number is a number
 * its data holds, which is the fourth claim and the reason this file does not re-assert it.
 */
import { describe, it, expect } from 'vitest';

import UPGRADES from '../../../docs/wayfinder/deck-archetypes/collection-v2/upgrades.json';
import { ProgramRegistry } from './programRegistry';
import { SPECIES_CARD_POOLS, RUN_ONLY_CARDS, NEUTRAL_UTILITY_IDS } from './speciesPools';
import { MingmingRegistry, getDeckForOS } from './mingmingRegistry';
import { isRewardable } from '../RewardSystem';
import { codexCardIds } from '../codex';
import type { ProgramData } from '../types';

const TABLE = UPGRADES as ReadonlyArray<{ id: string; name: string; plus: string; rule: string }>;
const plusIds = Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].upgradeOf);

describe('163a — the table is the registry', () => {
    it('gives every card in the ruled table exactly one `+`, and no card two', () => {
        expect(TABLE.length).toBe(98);

        const missing = TABLE.filter((row) => !ProgramRegistry[`${row.id}+`]).map((row) => row.id);
        expect(missing, 'in upgrades.json and not in the registry').toEqual([]);

        // And the other direction: a `+` in the registry that the table never ruled is a card
        // somebody added by hand, which is the failure the generator exists to prevent.
        const tabled = new Set(TABLE.map((row) => `${row.id}+`));
        const unruled = plusIds.filter((id) => !tabled.has(id));
        expect(unruled, 'in the registry and not in upgrades.json').toEqual([]);
        expect(plusIds).toHaveLength(98);
    });

    it('prints the text Henry ruled, not a paraphrase of it', () => {
        /*
         * The whole review loop runs on the `plus` column: Henry reads the table in the browser
         * and rules it, and what ships has to be that. A generator that rounded 65 to 60 on the
         * way in would pass every other test in this file.
         */
        const drift = TABLE
            .filter((row) => ProgramRegistry[`${row.id}+`]?.description !== row.plus)
            .map((row) => `${row.id}+: registry "${ProgramRegistry[`${row.id}+`]?.description}" vs table "${row.plus}"`);
        expect(drift).toEqual([]);
    });

    it('names each `+` after its base and points `upgradeOf` at a real card', () => {
        const broken: string[] = [];
        for (const id of plusIds) {
            const card = ProgramRegistry[id] as ProgramData;
            const base = ProgramRegistry[card.upgradeOf!];
            if (!base) { broken.push(`${id}: upgradeOf "${card.upgradeOf}" is not in the registry`); continue; }
            if (`${card.upgradeOf}+` !== id) broken.push(`${id}: upgradeOf says ${card.upgradeOf}`);
            if (card.name !== `${base.name}+`) broken.push(`${id}: named "${card.name}", base is "${base.name}"`);
        }
        expect(broken).toEqual([]);
    });

    it('is ONE RUNG — no upgrade of an upgrade', () => {
        // Henry ruled one upgraded form per card (163 §2). A `<id>++` would be a second rung
        // arriving as a naming accident rather than as a decision.
        const laddered = plusIds.filter((id) => ProgramRegistry[ProgramRegistry[id].upgradeOf!]?.upgradeOf);
        expect(laddered).toEqual([]);
        expect(Object.keys(ProgramRegistry).filter((id) => id.endsWith('++'))).toEqual([]);
    });
});

describe('163a — an upgrade never changes a card\'s shape', () => {
    it('keeps cost, element, category, width, side and exhaust', () => {
        /*
         * 163 §1's rule, as a test rather than as a sentence in a ticket: *"an upgrade changes a
         * number, adds a rider in the same currency, or widens the trigger. A `+` that turns an
         * enabler into a payoff is a new card, not an upgrade."* Everything listed here is a fact
         * about what the card IS, and none of it is allowed to move.
         */
        const SHAPE = ['baseCost', 'element', 'category', 'target', 'allyTarget', 'exhaust', 'isToken'] as const;
        const changed: string[] = [];
        for (const id of plusIds) {
            const card = ProgramRegistry[id] as unknown as Record<string, unknown>;
            const base = ProgramRegistry[ProgramRegistry[id].upgradeOf!] as unknown as Record<string, unknown>;
            for (const key of SHAPE) {
                if (card[key] !== base[key]) changed.push(`${id}: ${key} ${String(base[key])} -> ${String(card[key])}`);
            }
        }
        expect(changed).toEqual([]);
    });

    it('actually upgrades something — no `+` is a copy of its base', () => {
        /*
         * The failure this catches is a quiet one: a generic transform that matched nothing and
         * fell through would emit a `+` identical to its base, and every other test here would
         * pass. The card would sit in the workshop charging scrap for nothing.
         */
        const identical = plusIds.filter((id) => {
            const card = ProgramRegistry[id];
            const base = ProgramRegistry[card.upgradeOf!];
            return JSON.stringify(card.actions) === JSON.stringify(base.actions)
                && JSON.stringify(card.hooks ?? []) === JSON.stringify(base.hooks ?? []);
        });
        expect(identical, 'these + cards do exactly what their base does').toEqual([]);
    });

    it('gives every `+` daemon its own hooks, not a share of its base\'s', () => {
        /*
         * A `+` daemon whose `hooks` array still named the BASE hook ids would be an upgrade that
         * does the base card's numbers — the most plausible way for this pass to ship a lie, since
         * the card would resolve, log, and look right in every other check.
         */
        const shared: string[] = [];
        for (const id of plusIds) {
            const card = ProgramRegistry[id];
            const base = ProgramRegistry[card.upgradeOf!];
            for (const hookId of card.hooks ?? []) {
                if ((base.hooks ?? []).includes(hookId)) shared.push(`${id} shares ${hookId} with its base`);
            }
        }
        expect(shared).toEqual([]);
    });
});

describe('163a — nothing can reach a `+` card', () => {
    it('never offers one as a reward, a shop card or a wild-slot stranger', () => {
        // One assertion for all three, because all three go through `isRewardable` — which is the
        // reason the guard was put there rather than in `rewardCardPool`.
        const offerable = plusIds.filter((id) => isRewardable(id));
        expect(offerable).toEqual([]);
        // Guards the guard: the base cards it shadows ARE offerable, so a blanket `false` here
        // would not pass.
        expect(isRewardable('tackle')).toBe(true);
    });

    it('is in no kit, no start kit, no species pool and no run-only list', () => {
        const inADeck: string[] = [];
        for (const species of Object.keys(MingmingRegistry)) {
            for (const os of MingmingRegistry[species]?.availableOS ?? []) {
                const kit = MingmingRegistry[species]?.startKits?.[os] ?? [];
                for (const dataId of [...getDeckForOS(species, os), ...kit]) {
                    if (ProgramRegistry[dataId]?.upgradeOf) inADeck.push(`${os}: ${dataId}`);
                }
            }
        }
        expect(inADeck).toEqual([]);

        const pooled = [
            ...Object.values(SPECIES_CARD_POOLS).flat(),
            ...RUN_ONLY_CARDS,
            ...NEUTRAL_UTILITY_IDS,
        ].filter((id) => ProgramRegistry[id]?.upgradeOf);
        expect(pooled).toEqual([]);
    });

    it('is out of the codex denominator, like a token', () => {
        const counted = codexCardIds().filter((id) => ProgramRegistry[id].upgradeOf);
        expect(counted).toEqual([]);
    });
});
