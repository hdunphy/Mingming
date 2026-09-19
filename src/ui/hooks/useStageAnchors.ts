/**
 * TICKET 145 §3 — THE ANCHORS.
 *
 * `useStageAnchors()` returns `{ entityId -> rect }` for every slot on the stage, plus `reveal`
 * (the lane box) and `hand` (the fan's centre), in VIEWPORT pixels.
 *
 * # WHY THIS IS A PUBLISHED INTERFACE
 *
 * Ticket 146 (juice) fires particles, hit-stop and travel arcs at these rectangles, and its design
 * rests on one guarantee that this file exists to keep: **a slot does not move on selection, on a
 * death, or on a change of hand size.** Only the active ally's x changes (+60), and 146 reads the
 * new x when it changes. A component that measured the DOM would break that guarantee the first
 * time a plaque grew a status badge; deriving from `stageGeometry` cannot.
 *
 * A dead unit keeps its slot (§2b draws it as a 40%-brightness silhouette), so its anchor stays in
 * the map. That is deliberate — 146's death FX plays AT the slot, and an entity that vanished from
 * this map the frame it died would have nowhere to play it.
 */
import { useMemo, useSyncExternalStore } from 'react';

import type { IBattleState } from '../../engine/types';
import {
    place, plaqueRect, spriteRect, spriteWidthAt, DISCARD_ANCHOR, HAND_ANCHOR, REF_HEIGHT,
    REF_WIDTH, REVEAL_RECT,
    type StageRect,
} from '../components/stageGeometry';

export interface StageAnchors {
    /** Sprite box per entity id, living or dead. */
    readonly slots: Readonly<Record<string, StageRect>>;
    /** Plaque box per entity id — 146 lands status pops here rather than on the sprite. */
    readonly plaques: Readonly<Record<string, StageRect>>;
    readonly reveal: StageRect;
    readonly hand: StageRect;
    /** Where a spent card flies — ticket 146c step 5. */
    readonly discard: StageRect;
    /** The uniform scale the composition was placed at. 1 at exactly 1280x800. */
    readonly scale: number;
}

/**
 * Viewport size as a React store.
 *
 * `useSyncExternalStore` rather than a resize `useEffect`: the anchors are read during render by
 * anything that positions itself, and an effect-driven size is one frame stale on every resize —
 * which is one frame of particles landing where the sprite used to be.
 */
const subscribeToViewport = (onChange: () => void): (() => void) => {
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
};
const viewportSnapshot = (): string => `${window.innerWidth}x${window.innerHeight}`;

/**
 * What a SERVER render measures. There is no window, so it has to be told, and the default is the
 * reference frame — a `renderToStaticMarkup` of the stage IS the mock, which is the property
 * `BattleStage.test` leans on.
 *
 * `setServerViewport` exists because "the same markup at another size" is a real question and the
 * server path cannot answer it otherwise: `useSyncExternalStore` takes `getServerSnapshot` on every
 * server render regardless of what any surrounding browser is doing. Without this the 1920
 * screenshot ticket 145 §4.1 asks for silently renders at 1280 and looks like a scaling bug in the
 * geometry rather than in the harness — which is exactly what it did on the first attempt.
 */
let serverViewport = { width: REF_WIDTH, height: REF_HEIGHT };
export function setServerViewport(width: number, height: number): void {
    serverViewport = { width, height };
}
const viewportServerSnapshot = (): string => `${serverViewport.width}x${serverViewport.height}`;

export function useViewportSize(): { width: number; height: number } {
    const key = useSyncExternalStore(subscribeToViewport, viewportSnapshot, viewportServerSnapshot);
    return useMemo(() => {
        const [w, h] = key.split('x').map(Number);
        return { width: w, height: h };
    }, [key]);
}

/**
 * `activeAllyIndex` is the ally whose slot steps +60 — the caster the player is acting with, not
 * whichever unit is hovered. Passed in rather than derived here because `BattleArena` owns every
 * targeting decision on this screen and two sources of "who is active" is exactly how the step and
 * the rim light end up disagreeing.
 */
export function useStageAnchors(state: IBattleState, activeAllyIndex: number): StageAnchors {
    const { width, height } = useViewportSize();

    return useMemo(() => {
        const slots: Record<string, StageRect> = {};
        const plaques: Record<string, StageRect> = {};

        /*
         * ── TICKET 155, DEEP DIVE 5 — THE PLAQUE HANGS OFF THE DRAWN SPRITE ─────────────────
         *
         * `plaqueRect` places the plaque against the SLOT — `sprite.x + sprite.w + 8` — and the
         * slot is the unit's whole cell. But §4.1 CAPS the drawn sprite at `SPRITE_MAX_W`, so
         * above about 1.36 scale the art stops growing while the cell keeps going, and the gap
         * between them opens up. On the enemy side that pushed Sköll's plaque ~50px off her
         * sprite while Fenrir's sat at 8, because the ally plaque hangs off the cell's LEFT edge
         * and the enemy's off its right.
         *
         * The fix is to hang both off the drawn box instead. The sprite is centred in its cell
         * (`.stage-slot` is `justify-content: center`), so the drawn edges are the cell's edges
         * pulled in by half the difference — which is zero whenever the cap is not biting, and
         * the placement is unchanged at the mock.
         */
        const drawn = spriteWidthAt(place({ x: 0, y: 0, w: 1, h: 1 }, width, height).w);

        const anchor = (side: 'ally' | 'enemy', index: number, active: number): {
            slot: StageRect; plaque: StageRect;
        } => {
            const slot = place(spriteRect(side, index, active), width, height);
            const plaque = place(plaqueRect(side, index, active), width, height);
            const inset = Math.max(0, (slot.w - drawn) / 2);
            return {
                slot,
                plaque: { ...plaque, x: side === 'ally' ? plaque.x + inset : plaque.x - inset },
            };
        };

        state.playerParty.forEach((entity, index) => {
            const { slot, plaque } = anchor('ally', index, activeAllyIndex);
            slots[entity.id] = slot;
            plaques[entity.id] = plaque;
        });
        state.enemyParty.forEach((entity, index) => {
            const { slot, plaque } = anchor('enemy', index, -1);
            slots[entity.id] = slot;
            plaques[entity.id] = plaque;
        });

        return {
            slots,
            plaques,
            reveal: place(REVEAL_RECT, width, height),
            hand: place(HAND_ANCHOR, width, height),
            discard: place(DISCARD_ANCHOR, width, height),
            scale: place({ x: 0, y: 0, w: 1, h: 1 }, width, height).w,
        };
    }, [state.playerParty, state.enemyParty, activeAllyIndex, width, height]);
}
