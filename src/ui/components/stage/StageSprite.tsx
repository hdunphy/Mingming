import React, { useEffect } from 'react';
import { motion, useAnimate } from 'framer-motion';

import type { IBattleEntity } from '../../../engine/types';
import type { UnitFx } from '../../hooks/useBattleVfx';
import { elementVars } from '../../theme/kit/elementGlyphs';
import { prefersReducedMotion } from '../../utils/motionPrefs';
import { useClockedControls } from '../../vfx/clock/useClockedControls';
import { useDisplayedUnit } from '../../vfx/displayed/useDisplayedBoard';
import MonsterArtPlaceholder from '../MonsterArtPlaceholder';
import { MONSTER_ART_ENABLED } from '../monsterArtPolicy';
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
        const amp = 5 + 14 * hitIntensity;
        animate(scope.current, { x: [0, -amp, amp, -amp * 0.5, amp * 0.5, 0] }, { duration: 0.2 + 0.12 * hitIntensity });
    }, [hitKey, hitIntensity, animate, scope]);

    // Lunge toward the reveal lane: an ally moves right, an enemy left. Purely horizontal now that
    // the columns face each other across the lane.
    const lungeKey = fx?.lungeKey ?? 0;
    useEffect(() => {
        if (!lungeKey || prefersReducedMotion() || !scope.current) return;
        track(animate(
            scope.current,
            { x: [0, isEnemy ? -34 : 34, 0] },
            { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' },
        ));
    }, [lungeKey, isEnemy, animate, scope, track]);

    const showArt = MONSTER_ART_ENABLED && !!entity.artReference && !artBroken;
    const height = width * (SPRITE_H / SPRITE_W);

    return (
        <motion.div
            className={`stage-sprite-frame ${isDead ? 'stage-sprite-dead' : ''} ${deathGlitch ? 'stage-death-glitch' : ''}`}
            ref={scope}
            style={{ width, height }}
        >
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

            <FxTransientOverlays fx={fx} />
            <FxFloats fx={fx} rise={90} />
            <TerminatedStamp visible={isDead} glitching={deathGlitch} />
        </motion.div>
    );
};
