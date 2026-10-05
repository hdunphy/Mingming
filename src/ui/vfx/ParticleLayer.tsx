/**
 * THE PARTICLE LAYER — ticket 146a.
 *
 * One canvas over the stage, one rAF loop, and the registration that lets `emit()` reach it.
 * Everything with a number in it lives in `particles.ts` and `emitters.ts`; this file is wiring,
 * and it is deliberately the only part that knows React exists.
 *
 * # NOTHING HERE WATCHES THE BOARD
 *
 * Ruling 3: *"For now no persistent status emitters; it was the apply status or remove status that
 * should get an emitter."* §4 repeats it — persistent status emitters are out, because the plaque
 * badge is the standing read.
 *
 * The first build of this row missed that and polled `battleState` every frame, keeping every
 * burning unit on fire for as long as the status sat on it. It is worth naming the shape of the
 * mistake rather than just deleting it: a layer that can SEE the battle state will always drift
 * back toward drawing conditions instead of events, because the state is right there. So this
 * component no longer takes the state at all. Its only inputs are the anchors and the bus, and the
 * only way anything reaches the field is a call to `emit()` from a handler that saw something
 * happen. The property is structural, not a matter of remembering.
 *
 * # REDUCED MOTION TURNS IT OFF, NOT DOWN
 *
 * §2a: with reduced motion, particles are off. That is the whole accessibility argument in one
 * line: the particles are a SECOND telling of something the plaque already states, so removing
 * them costs a player nothing they needed. A "reduced" particle layer would still animate, which is
 * what the preference is asking us not to do.
 *
 * The gate is `resolveVfxGates`, not a bare media query, so the `particles` switch and the
 * reduced-motion choice are read through the one function that also stamps the DOM attributes.
 *
 * # WHY THE CANVAS IS SIZED IN AN EFFECT AND NOT IN JSX
 *
 * A canvas has two sizes: its CSS box and its backing store. Setting only the first gives you a
 * stretched 300x150 bitmap, which is the classic way canvas work looks blurry on every machine with
 * a HiDPI screen. The effect sets the backing store to `box * devicePixelRatio` and scales the
 * context to match, so one canvas pixel is one CSS pixel at any ratio.
 *
 * # WHOSE COORDINATES THE FIELD DRAWS IN
 *
 * `useStageAnchors` documents its rectangles as viewport pixels, but every consumer uses them as
 * CSS offsets inside `.battle-stage` — `StageSlot` renders `left: rect.x, top: rect.y` against an
 * absolutely-positioned parent, and has done since 145a shipped. So the anchors are, in practice,
 * stage-box coordinates.
 *
 * This canvas is `inset: 0` on that same box and draws with an IDENTITY transform for exactly that
 * reason: whatever the anchors mean, an effect lands wherever its sprite lands, because both read
 * the number the same way. Translating viewport-to-canvas here is the obvious-looking correction
 * and the wrong one — it offsets every particle by the stage box's own top-left.
 *
 * The rule for the later rows: take the anchor as given and do no arithmetic on it. If the anchors
 * are ever moved into true viewport space, `StageSlot` and this file change together or neither
 * does.
 */

import { useEffect, useRef } from 'react';

import { globalBattleEventBus } from '../../engine/events';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import type { StageAnchors } from '../hooks/useStageAnchors';
import type { ClockFrame } from './clock/BattleClock';
import { EffectField } from './attacks/EffectField';
import { ParticleField } from './particles';
import { setParticleSink, setStageAnchors } from './emit';
import { battleDriver } from './clock/battleClockRuntime';

interface Props {
    /**
     * Where things are. The layer holds these so that `emit()` callers can pass an entity's slot
     * rather than a raw point — but it never reads them on its own initiative.
     */
    readonly anchors: StageAnchors;
}

const ParticleLayer: React.FC<Props> = ({ anchors }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Published in an effect rather than during render: a render that React discards (a concurrent
    // pass, StrictMode's double call) must not leave the module pointing at anchors nobody sees.
    useEffect(() => {
        setStageAnchors(anchors);
        return () => setStageAnchors(null);
    }, [anchors]);

    useEffect(() => {
        if (!resolveVfxGates(loadSettings()).particles) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const field = new ParticleField();
        // Ticket 190d: beams, walls and waves, beside the particles they throw.
        const effects = new EffectField();
        // Backing store vs CSS box — see the header. The DPR is the only correction in the
        // transform; the coordinate system stays the stage box's own, untouched.
        let cssW = 1;
        let cssH = 1;
        const resize = (): void => {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            const box = canvas.getBoundingClientRect();
            cssW = Math.max(1, box.width);
            cssH = Math.max(1, box.height);
            canvas.width = Math.round(cssW * ratio);
            canvas.height = Math.round(cssH * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        /*
         * TICKET 189a — the layer no longer owns a rAF loop.
         *
         * It is a consumer of the battle clock's one driver, and steps by the CLOCK's delta: `gameDt`
         * is 0 while a hit-stop freeze stands (every particle holds position AND keeps its remaining
         * life, so a flame half-way through its rise is still half-way through it when the freeze
         * lifts), and it follows the speed policy for free when ticket 190 adds the tiers. Skipping
         * the frame instead would let the clock run on and the burst would jump forward when
         * drawing resumed, which is the opposite of the effect.
         */
        const consume = (frame: ClockFrame): boolean => {
            // The effects first: they throw particles into the field this same frame.
            const shapes = effects.step(frame.gameDt, (seeds) => field.spawn(seeds));
            const live = field.step(frame.gameDt);
            /*
             * Straight onto this canvas, which is transparent and which the browser lays over the
             * stage in ordinary blending. Drawing light ('lighter') on it sums the effects among
             * THEMSELVES, so a hundred flames still run up to a white-hot core, and the finished
             * frame covers the sand where it is dense and blends at its edges, like a sprite.
             *
             * 198b-1 did the same sum on a second, offscreen canvas and then copied the whole
             * stage-sized bitmap over this one every frame. The pixels were identical (checked at
             * device pixel ratios 1 and 2), and the copy was the stutter on big hits: it scales with
             * the canvas, not the particle count. See `ParticleLayer.draw.test.tsx`.
             */
            // CSS pixels, not `canvas.width/height` — those are DEVICE pixels, and under the DPR
            // transform they describe an area twice the canvas on a retina screen.
            ctx.clearRect(0, 0, cssW, cssH);
            effects.draw(ctx);
            field.draw(ctx);
            // An effect may leave light blending on; the next frame starts from ordinary.
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            /*
             * THE IDLE RULE (§2a): *"a single `rAF` loop that runs only while `alive > 0"`*. With
             * no persistent emitters there is no second condition to check — when the last particle
             * of a burst dies, nothing is coming until something else HAPPENS, and that something
             * calls `wake()` through `emit`. The driver parks itself when no consumer is live.
             */
            return live > 0 || shapes > 0;
        };

        const removeConsumer = battleDriver.addConsumer(consume);
        const wake = (): void => battleDriver.wake();

        setParticleSink({ spawn: (seeds) => field.spawn(seeds), addEffect: (effect) => effects.add(effect), wake });

        /*
         * THE BUS SUBSCRIPTION — §2a: *"driven by the same `globalBattleEventBus` subscription
         * `useBattleVfx` uses."*
         *
         * It is here and it maps nothing, which is 146a being infrastructure: the rows that decide
         * what each event LOOKS like are 146c (the cast sequence), 146f (status tells) and 146g (OS
         * tells), and each of them adds its cases to this switch. Subscribing now rather than in
         * the first row that needs it means the teardown, the guard and the idle interaction are
         * proven before any of them are load-bearing.
         *
         * The empty body is also the regression guard for ruling 3: anything this layer draws has
         * to arrive as an EVENT through here, and there is no other door.
         */
        const unsubscribe = globalBattleEventBus.subscribe(() => {
            // 146c / 146f / 146g fill this in.
        });

        return () => {
            unsubscribe();
            window.removeEventListener('resize', resize);
            removeConsumer();
            setParticleSink(null);
            field.clear();
            effects.clear();
        };
        // Mount-scoped on purpose: the loop owns its field, and re-running this effect on a state
        // change would tear that field down and rebuild it mid-burst.
    }, []);

    if (!resolveVfxGates(loadSettings()).particles) return null;

    return <canvas ref={canvasRef} className="stage-particles" aria-hidden="true" />;
};

export default ParticleLayer;
