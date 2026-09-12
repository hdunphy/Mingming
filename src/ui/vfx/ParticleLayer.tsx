/**
 * THE PARTICLE LAYER — ticket 146a.
 *
 * One canvas over the stage, one rAF loop, and the bridge from battle state to emitters. Everything
 * with a number in it lives in `particles.ts` and `emitters.ts`; this file is wiring, and it is
 * deliberately the only part that knows React exists.
 *
 * # REDUCED MOTION TURNS IT OFF, NOT DOWN
 *
 * §2: *"the particle layer is **off**, not smaller — the plaque chips still carry every status."*
 * That is the whole accessibility argument in one line: the particles are a SECOND telling of
 * something the plaque already states, so removing them costs a player nothing they needed. A
 * "reduced" particle layer would still animate, which is what the preference is asking us not to do.
 *
 * The check is `prefersReducedMotion()` rather than a media query, so the settings screen's
 * explicit on/off override wins over the OS the same way it does everywhere else.
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
 * reason: whatever the anchors mean, a flame lands wherever its sprite lands, because both read the
 * number the same way. Translating viewport-to-canvas here is the obvious-looking correction and
 * the wrong one — it offsets every particle by the stage box's own top-left and lifts every flame
 * off the body it belongs to.
 *
 * The rule for 146b/c/d: take the anchor as given and do no arithmetic on it. If the anchors are
 * ever moved into true viewport space, `StageSlot` and this file change together or neither does.
 */

import { useEffect, useRef } from 'react';

import type { IBattleState } from '../../engine/types';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { StageAnchors } from '../hooks/useStageAnchors';
import { ParticleField } from './particles';
import { STATUS_EMIT_INTERVAL_MS, burnEmitter, type EmitterAnchor } from './emitters';

interface Props {
    readonly battleState: IBattleState | null;
    readonly anchors: StageAnchors;
}

/** Every unit on the board with its Burn stacks, or an empty list. 146b adds the other statuses. */
function burningUnits(state: IBattleState | null): Array<{ id: string; stacks: number }> {
    if (!state) return [];
    const out: Array<{ id: string; stacks: number }> = [];
    for (const entity of [...state.playerParty, ...state.enemyParty]) {
        if (entity.currentHp <= 0) continue;
        const burn = entity.statusEffects?.find((s) => s.type === 'Burn');
        if (burn && burn.stacks > 0) out.push({ id: entity.id, stacks: burn.stacks });
    }
    return out;
}

const ParticleLayer: React.FC<Props> = ({ battleState, anchors }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fieldRef = useRef<ParticleField | null>(null);
    const frameRef = useRef<number | null>(null);
    const lastRef = useRef<number>(0);
    const emitAtRef = useRef<number>(0);
    /** The mount effect's loop starter, so the restart edge below can wake a parked loop. */
    const startRef = useRef<(() => void) | null>(null);

    /*
     * The live inputs, held in refs rather than closed over.
     *
     * The loop is started once and must see the CURRENT board — closing over `battleState` would
     * pin it to the state at the frame the loop began, so a unit that caught fire mid-turn would
     * never emit until something else restarted the loop. Refs are the standard answer and the
     * reason is worth stating: this is the one place where a stale closure is invisible rather than
     * a crash.
     *
     * The copy happens in an effect, not in the render body. Writing `ref.current` during render is
     * what `react-hooks/refs` forbids, and the rule is not pedantry here: React may render this
     * component without committing (a discarded concurrent pass, StrictMode's double render), and a
     * ref written on that pass would hand the loop a board that the screen never showed. An effect
     * runs only on a commit, so the field can never draw a state the player did not see.
     */
    const stateRef = useRef(battleState);
    const anchorsRef = useRef(anchors);
    useEffect(() => {
        stateRef.current = battleState;
        anchorsRef.current = anchors;
    });

    useEffect(() => {
        if (prefersReducedMotion()) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const field = new ParticleField();
        fieldRef.current = field;

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

        const rng = Math.random;

        const tick = (now: number): void => {
            const dt = lastRef.current === 0 ? 16 : now - lastRef.current;
            lastRef.current = now;

            // Feed the loops. Spawning is throttled (see STATUS_EMIT_INTERVAL_MS) rather than done
            // per frame, which is what keeps four statuses on six units inside the pool.
            if (now >= emitAtRef.current) {
                emitAtRef.current = now + STATUS_EMIT_INTERVAL_MS;
                for (const unit of burningUnits(stateRef.current)) {
                    const slot = anchorsRef.current.slots[unit.id];
                    if (!slot) continue;
                    field.spawn(burnEmitter(slot as EmitterAnchor, unit.stacks, rng));
                }
            }

            const live = field.step(dt);
            // CSS pixels, not `canvas.width/height` — those are DEVICE pixels, and under the DPR
            // transform they describe an area twice the canvas on a retina screen. Clearing too
            // little is the visible bug; this direction is only waste, which is why it survives
            // review so often.
            ctx.clearRect(0, 0, cssW, cssH);
            field.draw(ctx);

            /*
             * THE IDLE RULE (§2): a frame is only scheduled while there is something to draw OR
             * something that will shortly want to emit. Both halves are needed - stopping on `live
             * === 0` alone would park the loop forever the moment a burst finished, and a unit that
             * is still on fire would never light again.
             */
            if (live > 0 || burningUnits(stateRef.current).length > 0) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                frameRef.current = null;
                lastRef.current = 0;
            }
        };

        // Kick the loop whenever the board gains something to draw. Cheap: if it is already
        // running, `frameRef.current` is non-null and this does nothing.
        const start = (): void => {
            if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
        };
        startRef.current = start;
        start();

        return () => {
            window.removeEventListener('resize', resize);
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
            lastRef.current = 0;
            field.clear();
            fieldRef.current = null;
            startRef.current = null;
        };
        // Mount-scoped on purpose: the loop reads live values through refs, so re-running this
        // effect on every state change would tear down and rebuild the field mid-burst.
    }, []);

    /*
     * THE RESTART EDGE. The loop parks itself when the board goes quiet (the idle rule), so
     * something has to wake it when a unit catches fire — and the honest trigger is "the set of
     * burning units changed", which React already re-renders for.
     *
     * `startRef` is how: the mount effect stores its own starter there, and this effect calls it.
     * The alternative is re-running the mount effect on every state change, which would tear the
     * field down and rebuild it mid-burst.
     */
    const burningKey = burningUnits(battleState).map((u) => `${u.id}:${u.stacks}`).join(',');
    useEffect(() => {
        if (!burningKey) return;
        startRef.current?.();
    }, [burningKey]);

    if (prefersReducedMotion()) return null;

    return <canvas ref={canvasRef} className="stage-particles" aria-hidden="true" />;
};

export default ParticleLayer;
