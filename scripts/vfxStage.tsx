/**
 * THE VFX HARNESS — ticket 146.
 *
 * A live BattleStage in a real browser, with a board posed exactly as a juice row needs it. Every
 * row of 146 is judged on a picture (§6: *"Henry judges each row on the GIF — juice is not a
 * number"*), and a picture needs a running rAF loop, a real canvas and real compositing. None of
 * those exist in the two harnesses this repo already had:
 *
 * - `scripts/screenshots.mjs` walks a production build with Playwright. It photographs what a
 *   player can click to, which is the right instrument for "does this screen read" and the wrong
 *   one here: posing a board with two units on fire and a third frozen means winning fights.
 * - `scripts/screenshot-gallery.tsx` renders to static markup. A still frame of a particle system
 *   is a blank canvas — `renderToStaticMarkup` never runs an effect, so the loop never starts.
 *
 * So: mount the real component, client-side, against a hand-built state. Nothing is mocked except
 * the pose.
 *
 * Usage, from the repo root:
 *
 *     npx vite --port 5199 --strictPort &
 *     open http://localhost:5199/scripts/vfx-stage.html?burn=3
 *
 * Query parameters, so one page serves every row of the ticket rather than four pages drifting
 * apart:
 *   ?burn=N     Burn stacks on every living unit (default 3). 146a's proof.
 *   ?units=N    Party size per side, 1-3 (default 3) — §6's "3v3 with all six units".
 *   ?reduced=1  Force the reduced-motion override ON, which is how the off-switch is photographed.
 *
 * NOT part of any build: vite only bundles `index.html`, and `scripts/` is outside `src/`, so
 * `assert-no-debug.mjs` and the production bundle never see this file.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import BattleStage from '../src/ui/components/BattleStage';
import { createBattleState } from '../src/engine/data/battleFactories';
import type { IBattleSetup } from '../src/engine/data/battleFactories';
import { getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { SeedStream } from '../src/engine/core/SeedStream';
import { createRanchMember } from '../src/engine/gameTypes';
import { toMingmingState } from '../src/engine/run/battleSetup';
import { setReducedMotionOverride } from '../src/ui/utils/motionPrefs';
import { TOP_BAR_H, CONSOLE_H } from '../src/ui/components/stageGeometry';
import type { IBattleEntity, IBattleState } from '../src/engine/types';
import '../src/index.css';

const params = new URLSearchParams(window.location.search);
const num = (key: string, fallback: number): number => {
    const raw = Number(params.get(key));
    return Number.isFinite(raw) && params.has(key) ? raw : fallback;
};

const BURN = num('burn', 3);
const UNITS = Math.max(1, Math.min(3, num('units', 3)));
if (params.get('reduced') === '1') setReducedMotionOverride(true);

/*
 * The pose. Three Fenrirs a side is not a fight any run produces, and it does not need to be — what
 * 146a has to show is six sprites at six anchors with flames on each, and the cheapest honest way
 * to get six anchors is six units. The seed is fixed so two captures are comparable, which is the
 * same reason `screenshot-gallery.tsx` fixes its own.
 */
const SEED = 'vfx-harness';
const setup: IBattleSetup = {
    party: Array.from({ length: UNITS }, (_, i) =>
        toMingmingState(createRanchMember('fenrir', 'fenrir_v1', new SeedStream(`${SEED}-${i}`)))),
    deck: getDeckForOS('fenrir', 'fenrir_v1'),
    drivers: [],
    persistedHp: {},
};

const base = createBattleState(setup, Array.from({ length: UNITS }, () => 'ratatoskr'), undefined, {
    seed: SEED,
});

/** Put `BURN` stacks on every living unit. The status id shape is `${entityId}-burn`, as the engine writes it. */
const ignite = (party: ReadonlyArray<IBattleEntity>): IBattleEntity[] =>
    party.map((e) => (BURN > 0
        ? { ...e, statusEffects: [...e.statusEffects, { id: `${e.id}-burn`, type: 'Burn' as const, stacks: BURN }] }
        : { ...e }));

const battleState: IBattleState = {
    ...base,
    playerParty: ignite(base.playerParty),
    enemyParty: ignite(base.enemyParty),
};

/*
 * `.battle-screen` > 44px top bar > `.stage-area` > 210px console is the REAL chrome, reproduced
 * as spacers rather than as components. `.battle-stage` is `position: absolute; inset: 0` and has
 * no size of its own, and `stageGeometry.place()` derives every anchor from `TOP_BAR_H` and
 * `CONSOLE_H` — so a harness that mounted the stage in a bare full-viewport div would place all six
 * units somewhere no player ever sees them, and the capture would prove nothing about the game.
 *
 * The spacers are plain divs because the top bar and the console are not being photographed; their
 * HEIGHTS are the only thing the geometry reads.
 */
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <div className="battle-screen">
            <div style={{ height: TOP_BAR_H, flex: '0 0 auto' }} />
            <div className="stage-area">
                <BattleStage
                    battleState={battleState}
                    selectedSourceId={battleState.playerParty[0]?.id ?? null}
                    selectedTargetId={null}
                    selectedCardId={null}
                    hoveredEntityId={null}
                    isTargeting={false}
                    unitFx={{}}
                    onEntityClick={() => undefined}
                    onEntityPointerUp={() => undefined}
                    onEnemyHoverChange={() => undefined}
                />
            </div>
            <div style={{ height: CONSOLE_H, flex: '0 0 auto' }} />
        </div>
    </StrictMode>,
);
