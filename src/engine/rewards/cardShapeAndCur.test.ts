/**
 * TICKET 185e — **`shape` AND `cur` ARE ON THE CARD DATA, AND THEY ARE THE DESIGN RECORD'S.**
 *
 * `collection.json` is where 158 §2 tagged every card; the reward weights read the same two tags
 * from the registry (`programs.json`). This is the guard that the two cannot drift: every card in
 * the design record has the registry's `shape` and `cur` equal to its own, and the helper functions
 * read them through an upgrade.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ProgramRegistry } from '../data/programRegistry';
import { cardCurrencyOf, cardShapeOf, isPayoffCard } from './cardCurrency';

interface DesignCard { id: string; shape: string; cur: string }

const COLLECTION = path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2', 'collection.json');
const design: DesignCard[] = JSON.parse(fs.readFileSync(COLLECTION, 'utf8')).cards;

describe('ticket 185e — card shape and currency in the registry', () => {
    it('reads all 99 design cards', () => {
        expect(design).toHaveLength(99);
    });

    it.each(design.map((card) => [card.id, card] as const))('%s carries the design record\'s shape and cur', (id, card) => {
        const registered = ProgramRegistry[id];
        expect(registered, `${id} is in collection.json but not in the registry`).toBeDefined();
        expect(registered.shape, `${id} shape`).toBe(card.shape);
        expect(registered.cur, `${id} cur`).toBe(card.cur);
    });

    it('treats an upgraded card as the card it is a mark on', () => {
        const base = design.find((card) => card.shape === 'scalar')!;
        const plus = ProgramRegistry[`${base.id}+`];
        expect(plus, `${base.id}+ should be registered`).toBeDefined();
        expect(cardShapeOf(`${base.id}+`)).toBe('scalar');
        expect(cardCurrencyOf(`${base.id}+`)).toBe(base.cur);
        expect(isPayoffCard(`${base.id}+`)).toBe(true);
    });

    it('calls only scalar and consume cards payoffs', () => {
        for (const card of design) {
            expect(isPayoffCard(card.id), card.id).toBe(card.shape === 'scalar' || card.shape === 'consume');
        }
    });

    it('reads the design record\'s "no currency" mark as no currency', () => {
        const none = design.filter((card) => card.cur === '—');
        expect(none.length).toBeGreaterThan(0);
        for (const card of none) expect(cardCurrencyOf(card.id), card.id).toBeUndefined();
    });

    it('answers undefined for a card that does not exist', () => {
        expect(cardShapeOf('no_such_card')).toBeUndefined();
        expect(cardCurrencyOf('no_such_card')).toBeUndefined();
        expect(isPayoffCard('no_such_card')).toBe(false);
    });
});
