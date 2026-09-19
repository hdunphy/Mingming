// @vitest-environment jsdom
/**
 * TICKET 155, DEEP DIVE 2 — the lane is a POINT, and both axes have to agree on which point.
 *
 * The reveal is positioned absolutely at the lane and centred onto it with `x: '-50%'` and
 * `y: '-50%'`, which framer-motion writes as a transform. That means `top` and `left` must BOTH
 * be the rect's centre. The first cut of deep dive 2 passed `lane.y` — the rect's TOP edge —
 * against a `translateY(-50%)`, so the card hung half its own height above the lane: at 1280x800
 * its measured top was -9, off the top of the screen and behind the bar.
 *
 * Nothing caught it but a measurement in the write-back harness, which is exactly the class of
 * defect 155 exists to close. So it gets a test: the wrapper's inline `top` and `left` are the
 * anchor's centre, in both axes, or this fails.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import PlayedCardReveal from './PlayedCardReveal';
import { setStageAnchors } from '../vfx/emit';
import type { StageAnchors } from '../hooks/useStageAnchors';
import type { PlayedCardAnnouncement } from '../hooks/useBattleVfx';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Deliberately not square and not at the origin, so a top/centre mix-up cannot coincide. */
const REVEAL = { x: 566, y: 118, w: 148, h: 196 };
const box = (x: number) => ({ x, y: 300, w: 190, h: 190 });

const ANCHORS = {
    slots: { ally: box(100), foe: box(900) },
    plaques: { ally: box(20), foe: box(1100) },
    reveal: REVEAL,
    hand: { x: 570, y: 620, w: 140, h: 176 },
    discard: { x: 1100, y: 620, w: 140, h: 176 },
    scale: 1,
} as unknown as StageAnchors;

const PLAYED: PlayedCardAnnouncement = {
    key: 1,
    dataId: 'ignite',
    sourceId: 'ally',
    targetId: 'foe',
    fromPlayer: true,
    sourceName: 'Fenrir',
    targetName: 'Skoll',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    setStageAnchors(ANCHORS);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setStageAnchors(null);
});

/** The wrapper is the positioned element — the card face and the caption sit inside it. */
const wrapper = (): HTMLElement | null => container.querySelector('[aria-live="polite"]');

describe('155 deep dive 2 — the reveal sits ON the lane', () => {
    it('takes the CENTRE of the anchor on both axes, not the top-left corner', () => {
        act(() => root.render(<PlayedCardReveal played={PLAYED} />));

        const el = wrapper();
        expect(el).not.toBeNull();
        expect(el!.style.left).toBe(`${REVEAL.x + REVEAL.w / 2}px`);
        // The half-height is the part that was missing. 118 + 98, not 118.
        expect(el!.style.top).toBe(`${REVEAL.y + REVEAL.h / 2}px`);
    });

    it('falls back to the old percentages when the stage is not mounted', () => {
        setStageAnchors(null);
        act(() => root.render(<PlayedCardReveal played={PLAYED} />));

        const el = wrapper();
        expect(el!.style.left).toBe('50%');
        expect(el!.style.top).toBe('38%');
    });

    it('renders nothing at all with no play to announce', () => {
        act(() => root.render(<PlayedCardReveal played={null} />));
        expect(wrapper()).toBeNull();
    });
});
