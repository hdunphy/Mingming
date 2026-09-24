/**
 * THE HAND, RENDERED FOR A CHOSEN CASTER — ticket 22.
 *
 * `previewParity.test.ts` proves the preview number is the number the reducer will produce, and
 * `damagePreview.test.ts` proves the chips around it. Neither of them can catch the failure this
 * ticket exists for, because both ask the question for ONE caster.
 *
 * In 3v3 the deck and the hand are shared. The same card sits in front of three units with different
 * Attack stats and different elements, so its true damage is a property of the (caster, card,
 * target) triple. A hand that renders one number per card is therefore wrong for at least two of the
 * three casters — and wrong in the most dangerous way available, because the player has no reason to
 * distrust a figure that is right in the caster they happened to test it with.
 *
 * The Done-when names this suite: *"a component test covers caster switching"*. So the load-bearing
 * assertion is the first one below — the SAME card, in the SAME hand, against the SAME enemy, read
 * for two different casters, must print two different true numbers.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and a lockfile change is forbidden here. `renderToStaticMarkup` runs no
 * effects, which is why caster switching is exercised by re-rendering with a different
 * `selectedSourceId` in the store rather than by pressing W and E — the keypath itself is asserted
 * in the reducer-facing tests, and what this file is for is what the hand SAYS once it has switched.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import CardHand from './CardHand';
import battleSliceReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import type { Element, IBattleEntity, IBattleState } from '../../engine/types';

/**
 * `fire_punch_v2`: one ATTACK action, no scaling, no multi-hit, Fire, 1 Energy. Chosen because every
 * mechanic it does NOT have is a mechanic that could otherwise explain a difference between two
 * casters' numbers. What is left is the attacker's Attack stat and their elements, which is exactly
 * the pair this ticket is about.
 */
const CARD_ID = 'fire_punch_v2';

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name: id.toUpperCase(),
        definitionId: 'test_def',
        blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 200, currentHp: 200,
        cardDraw: 3, maxEnergy: 3, currentEnergy: 3,
        attack: 45, defense: 30, speed: 10,
        primaryElement: 'None' as Element, secondaryElement: 'None' as Element,
        tempHp: 0, statusEffects: [], daemons: [], hooks: [],
        playsThisTurn: 0,
        ...over,
    } as IBattleEntity;
}

/**
 * Three casters who differ in exactly the two things the preview is supposed to read:
 * - `blaze`   is Fire and hits hard  → STAB ×1.5 on a Fire card, on top of the bigger Attack.
 * - `trickle` is Water and hits soft → no STAB, and Water into a Nature enemy is neutral.
 * - `spark`   is Fire and hits soft  → STAB but not the Attack, so the two effects are separable.
 */
const PARTY: IBattleEntity[] = [
    unit('blaze', { primaryElement: 'Fire' as Element, attack: 120 }),
    unit('trickle', { primaryElement: 'Water' as Element, attack: 40 }),
    unit('spark', { primaryElement: 'Fire' as Element, attack: 40 }),
];

// Nature: Fire is SUPER EFFECTIVE into it (ElementalMatrix), so the matchup chip has something to
// say and the two Fire casters' numbers carry it.
const ENEMIES: IBattleEntity[] = [
    unit('sprout', { primaryElement: 'Nature' as Element, maxHp: 400, currentHp: 400 }),
    unit('bramble', { primaryElement: 'Nature' as Element, maxHp: 400, currentHp: 400 }),
    unit('thorn', { primaryElement: 'Nature' as Element, maxHp: 400, currentHp: 400 }),
];

function board(over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'hand-test',
        seed: 'hand-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeDrivers: [],
        playerParty: PARTY,
        enemyParty: ENEMIES,
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            drawpile: [],
            hand: [{ id: 'c1', dataId: CARD_ID, currentCost: 1, isPlayable: true }],
            discard: [],
            exhaust: [],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...over,
    } as unknown as IBattleState;
}

function render(
    sel: { source?: string | null; target?: string | null; card?: string | null } = {},
    over: Partial<IBattleState> = {},
): string {
    const store = configureStore({
        reducer: { battle: battleSliceReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: createEmptyRanch(),
            run: { run: null },
            battle: {
                battle: board(over),
                selectedSourceId: sel.source === undefined ? 'blaze' : sel.source,
                selectedTargetId: sel.target === undefined ? 'sprout' : sel.target,
                selectedCardId: sel.card ?? null,
            },
        },
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <CardHand />
        </Provider>,
    );
}

/** The true-damage figure the card face prints, e.g. `<span ...>37 DMG</span>` → 37. */
function trueDamage(markup: string): number {
    const m = markup.match(/([0-9]+) DMG/);
    expect(m, `no true-damage readout in:\n${markup}`).not.toBeNull();
    return Number(m![1]);
}

describe('CardHand reads for the SELECTED CASTER', () => {
    it('prints a DIFFERENT true number for the same card in two casters` hands', () => {
        // The Done-when's own test. `blaze` (Fire, attack 120) and `trickle` (Water, attack 40) are
        // looking at one card in one hand aimed at one enemy.
        const strong = trueDamage(render({ source: 'blaze' }));
        const weak = trueDamage(render({ source: 'trickle' }));

        expect(strong).toBeGreaterThan(0);
        expect(weak).toBeGreaterThan(0);
        expect(strong).not.toBe(weak);
        // Not merely different: the Fire caster with triple the Attack must read HIGHER, or the
        // hand is caster-aware in the wrong direction.
        expect(strong).toBeGreaterThan(weak);
    });

    it('separates the two things a caster brings — STAB is not just "more attack"', () => {
        // `spark` and `trickle` have identical Attack (40) and differ only in element. If the hand
        // were reading Attack alone these two would print the same figure.
        const fireCaster = trueDamage(render({ source: 'spark' }));
        const waterCaster = trueDamage(render({ source: 'trickle' }));
        expect(fireCaster).toBeGreaterThan(waterCaster);
    });

    it('shows the STAB signal only for the caster it applies to', () => {
        /*
         * Matched on `--stab-color` rather than on the string "×1.5": the SUPER chip legitimately
         * prints the same multiplier, and an assertion that cannot tell the two apart would pass on
         * a hand that had lost STAB entirely.
         *
         * TICKET 155e moved what this matches. It used to be `card-stab-pip`, the class on a `×1.5`
         * pip printed on the face — which ticket 66 had already ruled out and which had grown back.
         * The cue is the element GLOW on the card wrapper, set from `--stab-color`, so that is what
         * the test reads now. The requirement is unchanged: this caster gets the signal, that one
         * does not.
         */
        expect(render({ source: 'blaze' })).toContain('--stab-color');
        expect(render({ source: 'trickle' })).not.toContain('--stab-color');
    });

    it('shows the element matchup against the enemy the numbers are quoted for', () => {
        // Fire into Nature is ×1.5 in the ElementalMatrix; the chip is derived from the preview, so
        // it can only appear if the matchup actually applied to the simulated cast.
        expect(render({ source: 'blaze' })).toContain('SUPER');
    });

    it('names WHOSE HP the number is measured on, so the target is never an assumption', () => {
        expect(render({ source: 'blaze', target: 'sprout' })).toContain('SPROUT');
        expect(render({ source: 'blaze', target: 'thorn' })).toContain('THORN');
    });

    it('re-reads against a different enemy when the target changes', () => {
        // Same caster, same card, a tougher enemy. `bramble` carries a Defense buff here so the two
        // targets cannot answer the same.
        const soft = trueDamage(render({ source: 'blaze', target: 'sprout' }));
        const hard = trueDamage(render(
            { source: 'blaze', target: 'bramble' },
            { enemyParty: [ENEMIES[0], unit('bramble', { primaryElement: 'Nature' as Element, defense: 200, maxHp: 400, currentHp: 400 }), ENEMIES[2]] },
        ));
        expect(hard).toBeLessThan(soft);
    });

    it('says who it is reading for, and says so loudly when nobody is picked', () => {
        expect(render({ source: 'blaze' })).toContain('BLAZE');
        expect(render({ source: null })).toContain('NO CASTER');
    });

    it('states the reason a card cannot be cast rather than only greying it', () => {
        // Ticket 22 applies the tickets 13/14/20 convention to the last silent refusal in the hand.
        expect(render({ source: null })).toContain('Pick a caster first');
    });
});

/**
 * # A FINDING THIS SUITE DELIBERATELY DOES NOT FIX
 *
 * `.card-description` is the registry's own `description` string, and **142 of the 216 cards in
 * `programs.json` quote their power figure in it** — `fire_punch_v2` reads *"30 power."*, `scorch`
 * reads *"25 power. Apply 3 Burn."* That is a straight violation of the standing law, in the hand,
 * on the card face, and it predates ticket 22 by a long way.
 *
 * It survived ticket 13's identical assertion on the marketplace for an unhappy reason:
 * `ProgramCard` renders the description only inside a hover portal, so `renderToStaticMarkup` never
 * sees it and `MarketplaceNode.test.tsx` passes on a screen that does print power to a real player.
 * The battle hand renders the description unconditionally, so this suite is the first place the
 * problem is visible at all.
 *
 * Ticket 22 does not fix it. Rewriting 142 cards' player-facing copy is a content pass with real
 * balance-communication consequences (several of those strings are the only place a card explains
 * its scaling, and `drawScaling.test.ts` asserts against two of them), it is Henry's call how each
 * should read, and doing it quietly under a UI ticket is how a card stops matching its tests. It is
 * reported instead.
 *
 * So the assertions below hold the law over **everything ticket 22 owns** — the tooltip, the true
 * readout, the target legend, the cost badge, the footer — by excluding the registry string that is
 * a separate, larger, and already-broken problem. The exclusion is narrow and named on purpose: if
 * the leak ever creeps back into the chrome, this fails.
 */

/*
 * THE "power dies at the surface" BLOCK IS GONE — RETIRED by Henry, 2026-09-11:
 * *"I went back on my ruling because without it players can't compare cards ... We still need to
 * understand power on each card. Please remove that ruling."*
 *
 * Four assertions lived here: the hand never prints the word `power`, never leaks the printed
 * figure as a number, and a `stripDescriptions` helper that excused the card's own description
 * from both. They enforced a law that no longer exists, so they are deleted rather than loosened -
 * a test kept as `expect(true)` is a law nobody can find.
 *
 * The targeting case below was in the same block and is NOT about power. It survives.
 */
describe('CardHand names where a card may land', () => {
    it('replaces the raw TargetType enum with a phrase about where the card may land', () => {
        const markup = render({ source: 'blaze' });
        // TICKET 155e: the card carries the SHORT form as a tag on the name row — the long phrase
        // is two thirds of a 140px card's width and squeezed the names. The tooltip below still
        // spells it out, which the next assertion checks.
        expect(markup).toContain('ENEMY');
        expect(markup).not.toContain('>Single<');
        // The long phrase lives in the hover tooltip, which `renderToStaticMarkup` does not open —
        // `targeting.test.ts` is where the phrasing itself is asserted.
        expect(markup).not.toContain('ANY LIVING UNIT');
    });
});

describe('CardHand surfaces the draw formula', () => {
    it('prints the arithmetic for THIS party, not the formula', () => {
        // Three members at cardDraw 3: 3 + 3 + 3 − 2 = 7. The ticket asks for the working, because
        // "7" alone is the number ticket 08's start-deck ruling was derived from.
        const markup = render({ source: 'blaze' });
        expect(markup).toContain('BLAZE 3 + TRICKLE 3 + SPARK 3 − 2 = 7');
        expect(markup).toContain('Next refill draws 7 cards');
        expect(markup).toContain('+7/turn');
    });

    it('re-reads when a member falls — losing a body costs draw as well', () => {
        const downed = render({ source: 'blaze' }, {
            playerParty: [PARTY[0], PARTY[1], unit('spark', { primaryElement: 'Fire' as Element, currentHp: 0 })],
        });
        expect(downed).toContain('BLAZE 3 + TRICKLE 3 − 1 = 5');
        expect(downed).toContain('+5/turn');
    });
});

/**
 * TICKET 155e — the shell variables the card face paints with.
 *
 * Henry's report: *"energy pips don't appear"* and the cards *"don't look like the shop cards"*.
 * Both were one missing custom property. `--el` does not fall back when it is absent — it
 * INVALIDATES: `rgba(var(--el), …)` with nothing there is not a colour, so the pips render
 * transparent, the art band's gradient is dropped entirely, and the element foot bar disappears.
 *
 * The defect shipped past 201 green UI tests because nothing asserted on the style attribute — the
 * hand was rendering, and everything it rendered was the right shape and the wrong colour. This is
 * the cheapest possible guard against the class: the hand is one of five callers of the shared
 * shell and the only one that had ever forgotten.
 */
describe('155e — the hand sets the shell variables the shared card face needs', () => {
    it('sets --el on every hand card, as the shop and editor do', () => {
        const markup = render({ source: 'blaze' });
        expect(markup).toContain('--el:');
    });

    it('gives a Fire card the Fire colour rather than a neutral one', () => {
        // Not just "present": a card whose `--el` is the None grey would pass a presence check and
        // still look wrong, which is most of what the original defect looked like.
        const markup = render({ source: 'blaze' });
        expect(markup).toMatch(/--el:\s*#[0-9a-f]{6}/i);
        expect(markup).not.toMatch(/--el:\s*(undefined|null|;)/i);
    });
});

/**
 * TICKET 155 §3.10 — the guards that make this class of defect fail a test rather than a playtest.
 *
 * Every defect in 155 shipped past 201 green UI tests. What they had in common is that they were
 * about what the markup CARRIES — a custom property, a role, an action name — rather than about
 * what it computes, and nothing was looking there.
 */
describe('155 §3.10 — the markup carries what the player needs', () => {
    it('makes every hand card a control, not a div', () => {
        // Deep dive 8: no role, no tab stop, no keyboard path — so Tab skipped the entire hand,
        // on a screen whose own hotkey strip advertises `1-9 SELECT CARD`.
        const markup = render({ source: 'blaze' });
        expect(markup).toContain('role="button"');
        expect(markup).toContain('tabindex="0"');
        expect(markup).toContain('aria-label');
    });

    it('never prints a raw ActionType where a sentence belongs', () => {
        /*
         * 155g: `formatAction` switched on `APPLY_STATUS`, `REMOVE_STATUS` and `ADD_ENERGY`, none
         * of which are in `ActionType`. Every status card fell to `default: return action.type` and
         * rendered "STATUS STATUS STATUS" — Henry's screenshot. The `as string` cast above the
         * switch is what stopped the compiler saying so.
         *
         * The REAL guard is now a `never` check in that default case: a new `ActionType` breaks the
         * build rather than shipping a card that explains itself as its own enum. This is the
         * runtime half, and it is deliberately narrow — the tooltip only renders on hover, so what
         * is checked here is the markup that IS rendered. `DRAW` and `DISCARD` are excluded because
         * the pile labels legitimately print those words.
         */
        const markup = render({ source: 'blaze' });
        for (const raw of ['>STATUS<', '>ENERGY<', '>CLEANSE<', '>TAUNT<', '>EXHAUST<']) {
            expect(markup).not.toContain(raw);
        }
    });

    it('keeps the description row out of the fan until the card is lifted', () => {
        /*
         * Henry, 2026-09-20, off the 155 write-back's eleven-card shot: *"we can hide the card
         * descriptions, when you hover you see the whole card so thats fine."* At a wide hand each
         * card's right side is under the next one, and the description is the only row that needs
         * the full width — so it was the only row reading as half a sentence.
         *
         * `face-open` is the class that paints it, and this is the KEYBOARD half of it: selecting
         * with 1-9 puts no pointer on the card, so `selected` has to open the face on its own or a
         * keyboard player never sees a description at all. Hover is the other half and cannot be
         * reached through `renderToStaticMarkup`.
         */
        expect(render({ source: 'blaze' })).not.toContain('face-open');

        const selected = render({ source: 'blaze', card: 'c1' });
        expect(selected).toContain('face-open');
        // Exactly the one card, not the whole fan.
        expect(selected.match(/face-open/g)).toHaveLength(1);
    });

    it('does not open a requirements section with nothing in it', () => {
        // 155g: `formatConstraint` returned '' for BASE while the section still counted the row,
        // so a card blocked only on energy rendered an "⚠ REQUIREMENTS" header over empty space.
        const markup = render({ source: 'blaze' });
        const header = markup.indexOf('Requirements');
        if (header >= 0) {
            expect(markup.slice(header, header + 400)).toContain('tooltip-constraint');
        }
    });
});
