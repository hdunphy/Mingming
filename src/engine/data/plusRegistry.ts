/**
 * TICKET 163b — **the base ↔ `+` lookup, in one place.**
 *
 * 163a put ninety-eight upgraded cards in the registry under an id convention: `<base>+`, with
 * `upgradeOf` naming the base. The convention was enforced by a test and spelled out by string
 * concatenation wherever anyone needed it, which was nowhere, because nothing could reach a `+`
 * card. 163b is the row that gives them a way in — the workshop bench, the market stall and the
 * gym gate — so the concatenation is about to have several callers, and several callers spelling
 * `` `${id}+` `` is how one of them ends up asking a question the registry cannot answer.
 *
 * So: one module, and the rule is **ask the registry, do not trust the name**. `hasUpgrade` is a
 * registry lookup rather than a suffix test, because a card whose `+` was never authored would
 * otherwise be offered an upgrade that does not exist, and the failure would land in a shop.
 *
 * ONE RUNG. `<base>+` never has a `+` of its own (163 §2, Henry), so `upgradeIdFor` returns
 * undefined for a card that already carries `upgradeOf` — an upgrade bench asks this and gets a
 * "no" rather than a broken id, and `plusRegistry.test.ts` fails the build for a second rung in
 * the data.
 */
import { ProgramRegistry } from './programRegistry';
import type { ProgramData } from '../types';

/** Is this card an upgraded form? The typed question, so nothing tests for a trailing `+`. */
export function isUpgraded(dataId: string): boolean {
    return ProgramRegistry[dataId]?.upgradeOf !== undefined;
}

/**
 * The upgraded form of `dataId`, or undefined when there isn't one.
 *
 * Undefined for three different reasons and the caller does not need to tell them apart: the id
 * is not in the registry, the card is already upgraded, or nobody authored a `+` for it. All three
 * mean the same thing at a bench — this card is not upgradable — and collapsing them here is what
 * keeps that check one call rather than three.
 */
export function upgradeIdFor(dataId: string): string | undefined {
    const card = ProgramRegistry[dataId] as ProgramData | undefined;
    if (!card || card.upgradeOf !== undefined) return undefined;
    const plusId = `${dataId}+`;
    return ProgramRegistry[plusId] ? plusId : undefined;
}

/** True when this card has an upgraded form to buy. */
export function hasUpgrade(dataId: string): boolean {
    return upgradeIdFor(dataId) !== undefined;
}

/**
 * The base form of an upgraded card, or undefined when `dataId` is not one.
 *
 * Read off `upgradeOf` rather than by trimming the `+`, which is the same rule as above pointed
 * the other way: the field is the fact and the name is a convention that agrees with it.
 */
export function baseIdFor(dataId: string): string | undefined {
    return (ProgramRegistry[dataId] as ProgramData | undefined)?.upgradeOf;
}
