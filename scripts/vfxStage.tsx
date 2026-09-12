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
 *   ?kind=K     Which particle kind to fire (default `flame`). §2a's seven.
 *   ?burn=N     Intensity handed to the emitter (default 3). For `flame`, that is Burn stacks.
 *   ?units=N    Party size per side, 1-3 (default 3) — a 3v3 board with all six units.
 *   ?reduced=1  Force the reduced-motion override ON, which is how the off-switch is photographed.
 *
 * # THE HARNESS CALLS `emit`, THE GAME DOES NOT — YET
 *
 * Ruling 3 rules out persistent status emitters: the plaque badge is the standing read, and only
 * the MOMENT a status lands or leaves gets an effect. So nothing in the shipped game fires a
 * particle yet — 146c, 146f and 146g are the rows that decide what each event looks like.
 *
 * This page therefore drives `emit()` on a timer ITSELF. That is a harness doing a harness's job:
 * it lets the vocabulary be photographed and tuned one row ahead of the code that will trigger it,
 * without a single line of "just for now" emission living in `src/`. The timer is here and nowhere
 * else, which is the property that matters.
 *
 * NOT part of any build: vite only bundles `index.html`, and `scripts/` is outside `src/`, so
 * `assert-no-debug.mjs` and the production bundle never see this file.
 */

import { StrictMode } from 'react';
import { useAnimation } from 'framer-motion';
import { createRoot } from 'react-dom/client';

import BattleStage from '../src/ui/components/BattleStage';
import PlayedCardReveal from '../src/ui/components/PlayedCardReveal';
import { useBattleVfx } from '../src/ui/hooks/useBattleVfx';
import { useCastSequence } from '../src/ui/vfx/useCastSequence';
import { useImpactFeedback } from '../src/ui/vfx/useImpactFeedback';
import { createBattleState } from '../src/engine/data/battleFactories';
import type { IBattleSetup } from '../src/engine/data/battleFactories';
import { getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { SeedStream } from '../src/engine/core/SeedStream';
import { createRanchMember } from '../src/engine/gameTypes';
import { toMingmingState } from '../src/engine/run/battleSetup';
import { setReducedMotionOverride } from '../src/ui/utils/motionPrefs';
import { anchorFor, emit, emitImpact, emitTrail, type ParticleKind } from '../src/ui/vfx/emit';
import { globalBattleEventBus } from '../src/engine/events';
import { TRAIL_MS, TRAIL_STAGGER_MS, type TrailElement } from '../src/ui/vfx/trails';
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
const KIND = (params.get('kind') ?? 'flame') as ParticleKind;
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

/**
 * The badges still go on, because the point of ruling 3 is that the PLAQUE is the standing read —
 * a capture that shows flames without the badge under them is showing half the design.
 */
const ignite = (party: ReadonlyArray<IBattleEntity>): IBattleEntity[] =>
    party.map((e) => (BURN > 0
        ? { ...e, statusEffects: [...e.statusEffects, { id: `${e.id}-burn`, type: 'Burn' as const, stacks: BURN }] }
        : { ...e }));

const battleState: IBattleState = {
    ...base,
    playerParty: ignite(base.playerParty),
    enemyParty: ignite(base.enemyParty),
};

const everyUnitId = [...battleState.playerParty, ...battleState.enemyParty].map((e) => e.id);

/*
 * The timer that stands in for 146f. Fires the chosen kind at every unit on a loop, which is what
 * makes a still and a five-second GIF possible before any row triggers anything.
 *
 * 90ms rather than something faster: this is a harness pretending to be a stream of events, and at
 * this interval a burst is still legible as a burst. The real trigger will be one event, once.
 *
 * `?burn=0` stops the timer entirely rather than emitting nothing, so the capture's idle-rule probe
 * measures the LAYER parking itself and not the harness declining to speak.
 */
/*
 * A COLOUR, because six of the seven kinds do not have one of their own.
 *
 * Only `flame` carries its own gradient; `drop`, `leaf`, `spark`, `puff`, `ring` and `streak` take
 * theirs from the caller, since 146d passes the element colour and 146f passes
 * `STATUS_COLORS[status]`. Emitting them with no colour is therefore white — which on a Mingming's
 * near-white art card is invisible, and photographs as "the kind is broken" rather than "the kind
 * has no opinion". The harness supplies one so the SHAPE can be judged; the default is deliberately
 * a colour no sprite uses.
 */
const COLOR = (() => {
    const raw = params.get('color');
    const parts = raw?.split(',').map(Number);
    return parts?.length === 3 && parts.every(Number.isFinite)
        ? { r: parts[0], g: parts[1], b: parts[2] }
        : { r: 90, g: 210, b: 255 };
})();

/*
 * TRAIL MODE — `?trail=Fire`. Fires the element's trail from the first ally to the first enemy on a
 * loop, then its impact burst, which is 146c's steps 2 and 3 without the card flight around them.
 * The stagger mirrors §2c's Side-card rule so a three-target shot can be photographed too.
 */
const TRAIL = params.get('trail') as TrailElement | null;
if (TRAIL) {
    const from = () => anchorFor(battleState.playerParty[0].id);
    const targets = battleState.enemyParty.map((e) => e.id);
    window.setInterval(() => {
        const a = from();
        if (!a) return;
        targets.forEach((id, i) => {
            window.setTimeout(() => {
                const b = anchorFor(id);
                if (!b) return;
                emitTrail(TRAIL, a, b);
                window.setTimeout(() => emitImpact(TRAIL, b), TRAIL_MS);
            }, i * TRAIL_STAGGER_MS);
        });
    }, 520);
}

if (BURN > 0 && !TRAIL) {
    window.setInterval(() => {
        for (const id of everyUnitId) {
            const at = anchorFor(id);
            if (!at) continue;
            // `streak` is directional and degrades to a spark without somewhere to go, so the
            // harness gives it the other side of the board — which is what 146c will pass.
            const toward = KIND === 'streak'
                ? anchorFor(everyUnitId[everyUnitId.length - 1]) ?? undefined
                : undefined;
            emit(KIND, at, { intensity: BURN, color: COLOR, toward });
        }
    }, 90);
}

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
/*
 * ── CAST MODE — ticket 146h ────────────────────────────────────────────────────────────────────
 *
 * `?cast=Fire` fires a whole cast: the card reveal, the trail, the impact, the status tell and an
 * OS tell, by emitting on the REAL bus the same events the reducer emits, in the same synchronous
 * burst. Every subscriber 146 added runs for real — the window that groups a cast, the queue, the
 * hit-stop, the trails, the tells.
 *
 * Synthetic events rather than a live battle because the alternative is mounting `BattleArena` with
 * a full redux store and a run state, and none of it would exercise anything this ticket touched:
 * 146 changes no reducer and no rule. What it changes is what happens when those events arrive, and
 * this is those events arriving.
 *
 *   ?cast=<element>  the element to cast (default Fire)
 *   ?side=1          hit all three enemies, 146c's Side-card path and §2h's frame-budget case
 *   ?enemy=1         cast from the enemy side instead, for ruling 6's mirrored sequence
 */
const CAST = params.get('cast');
if (CAST) {
    const attackers = params.get('enemy') === '1' ? battleState.enemyParty : battleState.playerParty;
    const defenders = params.get('enemy') === '1' ? battleState.playerParty : battleState.enemyParty;
    const side = params.get('side') === '1';

    // Real card ids, so the reveal renders a real face rather than the registry's missing-card
    // stub — the capture is supposed to show what a player sees.
    const CARD_BY_ELEMENT: Record<string, string> = {
        Fire: 'cinder_slash', Water: 'hydro_blast', Nature: 'seed_bomb_v2', None: 'hamstring',
    };

    const fireCast = (): void => {
        const caster = attackers[0];
        const targets = side ? defenders : defenders.slice(0, 1);

        /*
         * ONE synchronous burst, exactly as the reducer produces: the play, then every hit, then
         * every status. If these were spread over timers the cast window in `useCastSequence` would
         * close between them and the capture would prove the opposite of what it is for.
         */
        globalBattleEventBus.emit({
            type: 'PROGRAM_PLAYED', sourceId: caster.id, targetId: targets[0].id,
            programId: CARD_BY_ELEMENT[CAST] ?? 'tackle', timestamp: Date.now(),
        });
        for (const target of targets) {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: target.id, amount: 24, element: CAST as never,
                cause: 'attack', damage: { raw: 24, absorbed: 0, applied: 24 } as never,
                timestamp: Date.now(),
            });
        }
        globalBattleEventBus.emit({
            type: 'STATUS_APPLIED', targetId: targets[0].id, status: 'Burn', stacks: 2,
            source: { kind: 'card', id: 'harness', ownerId: caster.id }, timestamp: Date.now(),
        });
        globalBattleEventBus.emit({
            type: 'HOOK_FIRED', osId: caster.activeOS, hookId: 'harness_hook',
            ownerId: caster.id, trigger: 'onPostDamage', timestamp: Date.now(),
        });
    };

    window.setTimeout(fireCast, 600);
    window.setInterval(fireCast, 2200);
}

/**
 * The stage plus everything `BattleArena` mounts around it that 146 touches: the cast sequence, the
 * impact feedback, and the played-card reveal. Not `BattleArena` itself — that needs a redux store
 * and a whole run — and none of what it would add is what this ticket changed.
 */
/*
 * Exported only to satisfy `react-refresh/only-export-components`, which wants a file containing a
 * component to export something. This file is a Vite ENTRY — nothing imports it — so the export is
 * a formality; splitting the component out would mean two files to keep in step for a harness.
 */
export const Stage: React.FC = () => {
    const vfx = useBattleVfx(battleState);
    const stageControls = useAnimation();
    useImpactFeedback(battleState, stageControls);
    useCastSequence(battleState);

    return (
        <>
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
            {/* `?noreveal=1` mounts everything EXCEPT the card face, which is how 146h attributes
                a frame spike to the reveal's mount rather than to the particle layer. */}
            {params.get('noreveal') === '1' ? null : <PlayedCardReveal played={vfx.playedCard} />}
        </>
    );
};

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <div className="battle-screen">
            <div style={{ height: TOP_BAR_H, flex: '0 0 auto' }} />
            <div className="stage-area">
                <Stage />
            </div>
            <div style={{ height: CONSOLE_H, flex: '0 0 auto' }} />
        </div>
    </StrictMode>,
);
