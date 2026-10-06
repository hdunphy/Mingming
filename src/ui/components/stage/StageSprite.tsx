import React, { useEffect } from 'react';
import { motion, useAnimate } from 'framer-motion';

import type { IBattleEntity } from '../../../engine/types';
import type { UnitFx } from '../../hooks/useBattleVfx';
import { elementVars } from '../../theme/kit/elementGlyphs';
import { prefersReducedMotion } from '../../utils/motionPrefs';
import { poseToFramer } from '../../vfx/choreo/attackPose';
import { onAttackPose } from '../../vfx/choreo/poseSignals';
import { onSpriteGlow, onSpriteReaction } from '../../vfx/landings/reactionSignals';
import { glowKeys, reactionKeys } from '../../vfx/landings/spriteReaction';
import { useClockedControls } from '../../vfx/clock/useClockedControls';
import { useDisplayedUnit } from '../../vfx/displayed/useDisplayedBoard';
import { targetShakePx } from '../../vfx/impact/impactMath';
import { spriteShakes, wakeImpactFx } from '../../vfx/impact/impactRuntime';
import MonsterArtPlaceholder from '../MonsterArtPlaceholder';
import { monsterArtShown } from '../monsterArtShown';
import { SPRITE_H, SPRITE_W } from '../stageGeometry';
import { FxFloats, FxTransientOverlays, TerminatedStamp } from '../UnitFxLayer';

/**
 * ONE SPRITE AND ITS EVENT-DRIVEN FX — ticket 145a, moved out of `BattleStage` in 183b.
 *
 * Unchanged in substance from the spotlight version — the hit shake, the lunge and the death glitch
 * are the same descriptors the HUD card used, so a unit that moved from a sidebar onto the stage
 * kept its whole feedback vocabulary. What changed is that six of these exist at once, so the frame
 * takes its size from the caller rather than from CSS.
 *
 * TICKET 183b — no glow. The rim light and the element haze 145b drew behind a body are gone: the
 * acting ally is said by its yellow platform and the caster cursor, and a body wears the one hard
 * 3px shadow the mock draws. The dead state is still a filter on the ART rather than an opacity on
 * the frame, so the TERMINATED stamp keeps its colour (ticket 34).
 */
interface StageSpriteProps {
    entity: IBattleEntity;
    isEnemy: boolean;
    fx?: UnitFx;
    width: number;
}

export const StageSprite: React.FC<StageSpriteProps> = ({ entity, isEnemy, fx, width }) => {
    const [scope, animate] = useAnimate();
    // TICKET 190f: the status reactions (dull, wobble, slump, pump) play on the ART, not on the frame
    // that carries the lunge and the shake, so the two never fight over one transform.
    const [artScope, animateArt] = useAnimate();
    // TICKET 194k-5: the 450 ms body glow plays on a wrapper inside the art, so it never fights a
    // reaction (dull, slump) for the same element's filter.
    const [glowScope, animateGlow] = useAnimate();
    // TICKET 189a: the lunge is held to the battle clock (speed, hit-stop freeze, Instant).
    const track = useClockedControls();
    const [deathGlitch, setDeathGlitch] = React.useState(false);
    const [artBroken, setArtBroken] = React.useState(false);
    // TICKET 189c: knocked out only after the killing impact, not when the engine says so.
    const shown = useDisplayedUnit(entity);
    const prevHpRef = React.useRef(shown.hp);
    const isDead = shown.isDown;

    useEffect(() => {
        // ticket 55: reviewed, not a defect. "Reset state when a prop changes"; the `key` React
        // would prefer would remount animation state that must outlive an art swap.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setArtBroken(false);
    }, [entity.artReference]);

    useEffect(() => {
        if (shown.hp <= 0 && prevHpRef.current > 0) {
            // ticket 55: reviewed. A 500ms one-shot owned by a timer, fired on an HP crossing only
            // a ref can see.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDeathGlitch(true);
            const timeout = setTimeout(() => setDeathGlitch(false), 500);
            prevHpRef.current = shown.hp;
            return () => clearTimeout(timeout);
        }
        prevHpRef.current = shown.hp;
    }, [shown.hp]);

    const hitKey = fx?.hitKey ?? 0;
    const hitIntensity = fx?.hitIntensity ?? 0;
    useEffect(() => {
        if (!hitKey || !scope.current) return;
        if (prefersReducedMotion()) {
            animate(scope.current, { x: 0, y: 0, opacity: [1, 0.6, 1] }, { duration: 0.25 });
            return;
        }
        // TICKET 189d: the target's jolt is the sprites' shudder field's, in GAME time, so a freeze
        // holds it and a shake that starts under a freeze starts when it lifts. `hitIntensity` is the
        // hit's severity, and the hit itself is drawn at the impact (the key moves then).
        spriteShakes.shake(entity.id, targetShakePx(hitIntensity));
        wakeImpactFx();
    }, [hitKey, hitIntensity, animate, scope, entity.id]);

    // The frame the field writes its `translate` to; it composes with the lunge's `transform`.
    useEffect(() => {
        const el = scope.current;
        return el ? spriteShakes.attach(entity.id, el) : undefined;
    }, [entity.id, scope]);

    /*
     * TICKET 190c — THE ATTACKER'S POSE. The presenter sends the whole pose when this body's cast
     * begins (crouch, lunge, hold until the hit, walk back; or a status-only card's wiggle); it plays
     * as ONE animation on the battle clock, so a hit-stop holds it where it is and Instant finishes it.
     * Reduced motion keeps the body still.
     */
    useEffect(() => onAttackPose((signal) => {
        if (signal.sourceId !== entity.id || prefersReducedMotion() || !scope.current) return;
        const framer = poseToFramer(signal.pose);
        track(animate(scope.current, framer.values, {
            duration: framer.durationS, times: framer.times, ease: framer.ease,
        }));
    }), [entity.id, animate, scope, track]);

    useEffect(() => onSpriteReaction((signal) => {
        if (signal.targetId !== entity.id || prefersReducedMotion() || !artScope.current) return;
        const keys = reactionKeys(signal.reaction);
        track(animateArt(artScope.current, { ...keys.values } as Record<string, number[] | string[]>, {
            duration: keys.durationMs / 1000, times: [...keys.times], ease: 'easeInOut',
        }));
    }), [entity.id, animateArt, artScope, track]);

    useEffect(() => onSpriteGlow((signal) => {
        if (signal.targetId !== entity.id || prefersReducedMotion() || !glowScope.current) return;
        const keys = glowKeys(signal.color);
        track(animateGlow(glowScope.current, { filter: [...keys.filter] }, {
            duration: keys.durationMs / 1000, times: [...keys.times], ease: 'easeOut',
        }));
    }), [entity.id, animateGlow, glowScope, track]);

    // A nudge toward the reveal lane for an action that has no cast behind it (an enemy's intent):
    // an ally moves right, an enemy left.
    const lungeKey = fx?.lungeKey ?? 0;
    useEffect(() => {
        if (!lungeKey || prefersReducedMotion() || !scope.current) return;
        track(animate(
            scope.current,
            { x: [0, isEnemy ? -34 : 34, 0] },
            { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' },
        ));
    }, [lungeKey, isEnemy, animate, scope, track]);

    const showArt = monsterArtShown(entity.artReference) && !artBroken;
    const height = width * (SPRITE_H / SPRITE_W);

    return (
        <motion.div
            className={`stage-sprite-frame ${isDead ? 'stage-sprite-dead' : ''} ${deathGlitch ? 'stage-death-glitch' : ''}`}
            ref={scope}
            style={{ width, height }}
        >
            <div className="stage-art-reaction" ref={artScope}>
                <div className="stage-art-glow" ref={glowScope}>
                    {showArt ? (
                        <img
                            src={new URL(`../../../assets/battleArt/mingming/${entity.artReference}`, import.meta.url).href}
                            alt={entity.name}
                            className="stage-art"
                            draggable={false}
                            style={{ transform: isEnemy ? 'scaleX(-1)' : 'none' }}
                            onError={() => setArtBroken(true)}
                        />
                    ) : (
                        // The art-less fallback earns the same dead state, or a species without a sprite yet
                        // would be the one unit on the board that never looks terminated.
                        <MonsterArtPlaceholder className="stage-art-wip" style={elementVars(entity.primaryElement)} />
                    )}
                </div>
            </div>

            <FxTransientOverlays fx={fx} />
            <FxFloats fx={fx} rise={90} />
            <TerminatedStamp visible={isDead} glitching={deathGlitch} />
        </motion.div>
    );
};
