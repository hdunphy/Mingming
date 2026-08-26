// @vitest-environment jsdom
/**
 * DECLINING A CARD — ruling 4 (Henry, playtest 2026-08-24): *"you should be able to skip rewards"*,
 * and, asked per-card or per-screen, *"skip per card."*
 *
 * A click-level test (ticket 58's harness), because the whole behaviour is a state machine driven
 * by clicks: three states per pick, a gate over all of them, and a button that has to un-skip as
 * cleanly as it skips. `renderToStaticMarkup` can see the SKIP button exists and nothing else.
 *
 * The assertion that matters is the LAST one in each case — what `onContinue` receives. A screen
 * that lets you press SKIP and then hands the card over anyway is worse than no skip at all.
 *
 * ---
 *
 * WHERE A TAKEN CARD GOES — ticket 61 §2: *"each taken pick offers per-card: ADD TO ACTIVE DECK, or
 * STORE in the run collection."*
 *
 * The same file because it is the same state machine seen one turn later. Ruling 4 gave a pick three
 * states — unresolved, taken, declined — and §2 hangs a fourth question off exactly one of them:
 * having taken the card, is it going into the deck you are about to fight with, or into the shelf?
 * The two rulings are answers to the same complaint from the same playtest. Skipping exists because
 * a mandatory pick per defeated body diluted the deck faster than a 20-scrap removal could clean it;
 * the collection exists so that skipping stops being the only defence — *"it doesn't feel bad to
 * grab all the cards even if you don't plan to use them."*
 *
 * And that is why these cases are click-level too, and why the last assertion in each is again what
 * `onContinue` receives. `storedInstanceIds` is a THIRD argument, optional, on a callback whose two
 * existing arguments are unchanged — the least visible signature in the codebase to get wrong. A
 * screen that renders both buttons, highlights the one you pressed, and then hands the run every
 * card for the deck anyway looks completely correct from the outside, and the only place the
 * difference shows up is in a deck that grew when the player told it not to.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import BattleReport from './BattleReport';
import type { IOwnedProgram, IRewardBundle } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const owned = (dataId: string, n: number): IOwnedProgram =>
    ({ instanceId: `${dataId}_${n}`, dataId } as IOwnedProgram);

/** Two picks, as a 2v2 win pays: one per defeated body. */
const BUNDLE: IRewardBundle = {
    scraps: 15,
    blueprints: [],
    cards: [],
    cardChoices: [
        { sourceEntityName: 'Draugr', options: [owned('water_slap', 1), owned('hydro_blast', 1), owned('nettle_sting', 1)] },
        { sourceEntityName: 'Control', options: [owned('water_slap', 2), owned('hydro_blast', 2), owned('nettle_sting', 2)] },
    ],
};

const WINNERS: ReadonlyArray<IBattleEntity> = [];

let host: HTMLDivElement;
let root: Root;
let onContinue: ReturnType<typeof vi.fn>;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onContinue = vi.fn();
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
});

async function mount(): Promise<void> {
    await act(async () => {
        root.render(<BattleReport bundle={BUNDLE} winners={WINNERS} onContinue={onContinue} />);
    });
}

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll('button')];
const skipButtons = (): HTMLButtonElement[] =>
    buttons().filter(b => (b.textContent ?? '').includes('SKIP'));
const continueButton = (): HTMLButtonElement =>
    buttons().find(b => (b.textContent ?? '').includes('CONTINUE SYNCHRONIZATION'))!;

async function click(el: Element): Promise<void> {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

/**
 * `RevealCard` refuses clicks until it has finished flipping, so every case that takes a card has to
 * wait the animation out rather than click into a gate — the same 1400ms the mixed case below has
 * used since ticket 58, and the same real timers, because framer-motion drives the flip and a faked
 * clock would leave the cards face-down and hand the test a silent pass.
 *
 * 1400 is not a round number picked for comfort: the last card of the second pick reveals at
 * `REVEAL_BASE_DELAY_MS + (1 * 3 + 2) * REVEAL_STAGGER_MS` = 900ms and takes `FLIP_DURATION_S` to
 * turn over, so 1400 is the first moment every card on the screen is clickable.
 */
async function revealAll(): Promise<void> {
    await act(async () => { await new Promise(r => setTimeout(r, 1400)); });
}

/**
 * One element per pick, in `bundle.cardChoices` order.
 *
 * Anchored on `.reward-card-row` and walked up to its parent, because the group `div` itself carries
 * a class only while it is unresolved (`choice-group-pending`) — indexing on something that appears
 * and disappears as the player answers is how a selector-based test starts asserting about the wrong
 * pick halfway through a case. The card row is always there.
 */
const groups = (): HTMLElement[] =>
    [...host.querySelectorAll('.reward-card-row')].map(row => row.parentElement as HTMLElement);

/** The ADD TO ACTIVE DECK / STORE IN COLLECTION pair inside one pick — empty until it is taken. */
const destButtonsIn = (index: number): HTMLButtonElement[] =>
    [...groups()[index].querySelectorAll<HTMLButtonElement>('.reward-dest-btn')];

/** Which of that pair is lit, by the `on` class the component paints the active choice with. */
const litDestIn = (index: number): string[] =>
    destButtonsIn(index).filter(b => b.classList.contains('on')).map(b => b.textContent ?? '');

/** Take one of a pick's three options. Assumes `revealAll` has already run. */
async function take(index: number, option = 0): Promise<HTMLElement> {
    const card = groups()[index].querySelectorAll('.reward-card-row > *')[option];
    expect(card).toBeTruthy();
    await click(card);
    return card as HTMLElement;
}

/** The third argument of the one `onContinue` call — the ids routed to the collection. */
const storedArg = (): ReadonlyArray<string> =>
    onContinue.mock.calls[0][2] as ReadonlyArray<string>;

describe('skipping a card pick', () => {
    it('blocks CONTINUE while a pick is neither taken nor declined', async () => {
        await mount();
        expect(continueButton().disabled).toBe(true);
        expect(host.textContent).toContain('UNRESOLVED CHOICES REMAINING');
    });

    it('offers one SKIP per pick — the ruling was per card, not one button for the screen', async () => {
        await mount();
        expect(skipButtons()).toHaveLength(BUNDLE.cardChoices.length);
    });

    it('unblocks CONTINUE when every pick is declined, and takes nothing', async () => {
        await mount();
        for (const b of skipButtons()) await click(b);

        expect(continueButton().disabled).toBe(false);
        expect(host.textContent).not.toContain('UNRESOLVED CHOICES REMAINING');

        await click(continueButton());
        expect(onContinue).toHaveBeenCalledTimes(1);
        // The point of the whole ruling: a declined pick puts NO card in the deck.
        expect(onContinue.mock.calls[0][0]).toEqual([]);
    });

    it('a declined pick can be un-declined by pressing it again', async () => {
        await mount();
        const skip = skipButtons()[0];
        await click(skip);
        expect(skipButtons()[0].textContent).toContain('SKIPPED');

        await click(skipButtons()[0]);
        // Back to unresolved — not silently resolved-as-taken, which would put a card the player
        // never chose into the deck.
        expect(continueButton().disabled).toBe(true);
        expect(skipButtons()[0].textContent).toBe('SKIP');
    });

    it('mixes freely: take one, decline the other, and only the taken card is handed over', async () => {
        await mount();
        // Decline the SECOND pick, then take a card from the first.
        await click(skipButtons()[1]);

        // `RevealCard` refuses clicks until it has finished flipping (`revealDelayMs` plus the
        // stagger), so this waits the animation out rather than clicking into a gate. Real timers,
        // because framer-motion drives the flip — a faked clock would just leave it un-revealed and
        // hand this test a silent pass, which is the failure mode ticket 58 exists to stop.
        await act(async () => { await new Promise(r => setTimeout(r, 1400)); });

        const firstGroupCard = host.querySelector('.reward-card-row > *');
        expect(firstGroupCard).toBeTruthy();
        await click(firstGroupCard!);

        expect(continueButton().disabled).toBe(false);
        await click(continueButton());

        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        // Exactly one card: the one taken. The declined group contributed nothing.
        expect(chosen).toHaveLength(1);
        expect(BUNDLE.cardChoices[0].options.some(o => o.instanceId === chosen[0].instanceId)).toBe(true);
        expect(BUNDLE.cardChoices[1].options.some(o => o.instanceId === chosen[0].instanceId)).toBe(false);
    });
});

describe('routing a taken card — deck or collection', () => {
    it('shows no destination buttons until a card is actually taken', async () => {
        await mount();
        await revealAll();

        // The component's own reasoning, asserted: *"shown only once a card IS taken, because until
        // then there is nothing to route and a pair of dead buttons above three live cards would
        // read as part of the choice."* That last clause is the real hazard and it is a design one
        // rather than a correctness one — ADD TO ACTIVE DECK sitting above three face-up cards
        // before anything is picked looks like a fourth thing to click, and a player who reads it
        // that way has been given a question with no answer. Rendering the pair disabled would be
        // the well-meant patch, and it would be the same mistake wearing grey.
        expect(host.querySelectorAll('.reward-dest-btn')).toHaveLength(0);
        expect(destButtonsIn(0)).toHaveLength(0);
        expect(destButtonsIn(1)).toHaveLength(0);

        // Taking one card arms exactly that pick's row and leaves the other pick alone. Per card,
        // like the SKIP it sits under — the two rulings are the same shape, and a single row for
        // the whole screen would force one destination onto every card a 3v3 pays out.
        await take(0);
        expect(destButtonsIn(0)).toHaveLength(2);
        expect(destButtonsIn(1)).toHaveLength(0);
        expect(destButtonsIn(0).map(b => b.textContent))
            .toEqual(['ADD TO ACTIVE DECK', 'STORE IN COLLECTION']);
    });

    it('pre-selects the deck, because this refines a decision rather than adding one', async () => {
        await mount();
        await revealAll();
        await click(skipButtons()[1]);
        await take(0);

        // *"The default is the deck, because the card you just chose out of three is usually the
        // one you want to play — STORE is for the pick you take because it is free."* One of the
        // pair is lit from the moment the row appears, and it is the deck's.
        expect(litDestIn(0)).toEqual(['ADD TO ACTIVE DECK']);
        expect(destButtonsIn(0)[0].getAttribute('aria-pressed')).toBe('true');
        expect(destButtonsIn(0)[1].getAttribute('aria-pressed')).toBe('false');

        // The default is what makes this a refinement of a decision already made instead of a
        // second decision: it does not gate CONTINUE. Both picks are resolved here — one taken,
        // one declined — and the screen is finishable without the destination row ever being
        // touched, which is exactly the pre-61 behaviour a player who never notices the pair
        // still gets. Leaving the pair unlit until pressed would turn every taken card into
        // another unresolved choice, which is the thing ruling 4 was written to stop the screen
        // doing; `isResolved` reads `selections` and `skipped` and deliberately not `stored`.
        expect(continueButton().disabled).toBe(false);
        expect(host.textContent).not.toContain('UNRESOLVED CHOICES REMAINING');
    });

    it('leaves a card on the default out of storedInstanceIds entirely', async () => {
        await mount();
        await revealAll();
        await take(0);
        await click(skipButtons()[1]);

        await click(continueButton());
        expect(onContinue).toHaveBeenCalledTimes(1);

        // The half of the contract that is easy to get backwards. `storedInstanceIds` names what
        // is NOT going to the deck — *"everything not named goes to the deck, which keeps the
        // default where it has always been and makes the new argument ignorable by a caller that
        // has no collection (the debug scenarios)"* — so a card left on the default appears in the
        // first argument and nowhere else. An implementation that listed every taken card here and
        // let the caller subtract would be the same information inverted, and every existing
        // caller of `onContinue` would silently start shelving the whole reward screen.
        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        expect(chosen).toHaveLength(1);
        expect(chosen[0].instanceId).toBe(BUNDLE.cardChoices[0].options[0].instanceId);
        expect(storedArg()).toEqual([]);
    });

    it('hands back the instance id of a card sent to the collection', async () => {
        await mount();
        await revealAll();
        await take(0);

        await click(destButtonsIn(0)[1]);
        expect(litDestIn(0)).toEqual(['STORE IN COLLECTION']);

        await click(skipButtons()[1]);
        await click(continueButton());

        // The whole feature in one line. The card is still TAKEN — it is in the first argument,
        // because the player picked it and it is theirs — and it is also named in the third, which
        // is what tells `BattleArena` to mint it into `IRunState.collection` rather than the deck.
        // A screen that lit the button and forgot to say so is indistinguishable from a working
        // one right up until the deck is counted, and the deck is counted against a floor that the
        // player is expected to be managing deliberately.
        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        const wanted = BUNDLE.cardChoices[0].options[0].instanceId;
        expect(chosen.map(c => c.instanceId)).toEqual([wanted]);
        expect(storedArg()).toEqual([wanted]);
    });

    it('routes a mixed screen per card: one stored, one decked, exactly one id back', async () => {
        await mount();
        await revealAll();
        await take(0);
        await take(1);

        // Store the SECOND pick and leave the first on the default, so the two picks disagree and
        // the ids cannot be told apart by accident — this is the case that catches an
        // implementation keyed on the wrong index, which every case with one taken card passes.
        await click(destButtonsIn(1)[1]);
        expect(litDestIn(0)).toEqual(['ADD TO ACTIVE DECK']);
        expect(litDestIn(1)).toEqual(['STORE IN COLLECTION']);

        await click(continueButton());

        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        const deckBound = BUNDLE.cardChoices[0].options[0].instanceId;
        const shelfBound = BUNDLE.cardChoices[1].options[0].instanceId;

        // Both cards are taken — the destination is not a second kind of skip, and a 2v2 that pays
        // two picks still pays two cards however they are filed.
        expect(chosen.map(c => c.instanceId)).toEqual([deckBound, shelfBound]);
        // And exactly one of them is shelved.
        expect(storedArg()).toEqual([shelfBound]);
        expect(storedArg()).not.toContain(deckBound);
    });

    it('forgets a destination when the pick is declined, rather than leaving it lying in wait', async () => {
        await mount();
        await revealAll();
        await take(0);
        await click(destButtonsIn(0)[1]);
        expect(litDestIn(0)).toEqual(['STORE IN COLLECTION']);

        // SKIP that pick. The row goes with it, because *"a declined pick has nowhere to go"* — and
        // the reset is the load-bearing half of that sentence rather than tidiness. `stored` is
        // keyed by choice INDEX and `selections` is keyed the same way, so a STORE flag left set
        // on a declined slot would still be there when the player changed their mind and took a
        // different card in that same slot. They would then be handed a screen reading ADD TO
        // ACTIVE DECK, and a card that went to the collection anyway: the one failure mode where
        // the UI and the outcome actively disagree, which is strictly worse than either default.
        await click(skipButtons()[0]);
        expect(destButtonsIn(0)).toHaveLength(0);

        // Take a different option in the same slot — a different `RevealCard` instance, so this is
        // not clicking into the selection pulse the first card is still playing out.
        await take(0, 1);
        expect(destButtonsIn(0)).toHaveLength(2);
        expect(litDestIn(0)).toEqual(['ADD TO ACTIVE DECK']);

        await click(skipButtons()[1]);
        await click(continueButton());

        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        expect(chosen.map(c => c.instanceId)).toEqual([BUNDLE.cardChoices[0].options[1].instanceId]);
        expect(storedArg()).toEqual([]);
    });
});
