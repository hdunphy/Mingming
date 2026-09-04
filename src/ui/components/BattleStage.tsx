import React, { useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { UnitFx } from '../hooks/useBattleVfx';
import { FxTransientOverlays, FxFloats, TerminatedStamp } from './UnitFxLayer';
import { getElementAccent } from '../utils/contrastText';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { GetProgramData } from '../../engine/data/programRegistry';
import { targetVerdict } from '../utils/targeting';

/**
 * BattleStage — the Pokémon-style center stage of the battle screen.
 *
 * Fills the void between the two party sidebars with two big spotlights:
 *  - bottom-left: the currently selected player unit ("back-sprite" position)
 *  - top-right:   the focus enemy (hovered target > selected target > first living)
 *
 * The spotlights are an ALTERNATIVE interaction surface: clicking the enemy
 * spotlight targets it, dropping a dragged card on it plays the card there —
 * both through the exact same handlers the sidebar HUD cards use. The full
 * unit HUD stays in the sidebars; the stage only carries compact plaques.
 *
 * FX reuse: the same per-entity UnitFx descriptors that drive the sidebar
 * cards are rendered here through the shared UnitFxLayer components, so the
 * two spotlighted entities get their damage floats, flashes, lunges and death
 * glitch on the big sprites too (sidebar feedback is untouched).
 */

const SWAP_DURATION = 0.2;

const getHpColor = (percent: number) => {
    if (percent < 25) return '#ef4444';
    if (percent < 50) return '#ff8c00';
    return '#22c55e';
};

const intentIcon = (intentType: string) =>
    intentType === 'Attack' ? '⚔️' :
        intentType === 'Defend' ? '🛡️' :
            intentType === 'Debuff' ? '🧪' : '🌟';

/** Slim HP/EP bar for the stage plaques (the full segmented HUD stays in the sidebar). */
const StageBar: React.FC<{ percent: number; color: string; glow?: boolean }> = ({ percent, color, glow }) => (
    <div className="stage-bar-track">
        <motion.div
            className="stage-bar-fill"
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ background: color, boxShadow: glow ? `0 0 8px ${color}` : 'none' }}
        />
    </div>
);

interface StageSpriteProps {
    entity: IBattleEntity;
    isEnemy: boolean;
    fx?: UnitFx;
}

/**
 * The big battle sprite + its event-driven FX. Mirrors MingmingUnit's
 * hit-shake / lunge / death-glitch behavior at stage scale.
 * Frame size lives in CSS (viewport-clamped per spotlight side).
 */
const StageSprite: React.FC<StageSpriteProps> = ({ entity, isEnemy, fx }) => {
    const controls = useAnimation();
    const [deathGlitch, setDeathGlitch] = React.useState(false);
    const [artBroken, setArtBroken] = React.useState(false);
    const prevHpRef = React.useRef(entity.currentHp);
    const isDead = entity.currentHp <= 0;
    const accent = getElementAccent(entity.primaryElement);

    // The art fallback state is per-entity (a swapped-in unit gets a fresh try).
    useEffect(() => {
        // ticket 55: reviewed, not a defect. This is "reset state when a prop changes"; React's
        // preferred alternative is a `key` on this component, which the parent cannot supply
        // without re-keying the whole stage and remounting the animation state that outlives an art
        // swap.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setArtBroken(false);
    }, [entity.artReference]);

    // Death FX: CRT glitch on the frame HP hits 0 (same beat as the HUD card).
    useEffect(() => {
        if (entity.currentHp <= 0 && prevHpRef.current > 0) {
            // ticket 55: reviewed, not a defect. A 500ms one-shot FX owned by a timer, fired on an
            // HP-crossing that only a ref can see. Same shape as the turn banner in `BattleArena`.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDeathGlitch(true);
            const timeout = setTimeout(() => setDeathGlitch(false), 500);
            prevHpRef.current = entity.currentHp;
            return () => clearTimeout(timeout);
        }
        prevHpRef.current = entity.currentHp;
    }, [entity.currentHp]);

    // Hit shake, scaled by damage fraction (larger travel than the HUD card).
    const hitKey = fx?.hitKey ?? 0;
    const hitIntensity = fx?.hitIntensity ?? 0;
    useEffect(() => {
        if (!hitKey) return;
        if (prefersReducedMotion()) {
            controls.start({ x: 0, y: 0, opacity: [1, 0.6, 1], transition: { duration: 0.25 } });
            return;
        }
        const amp = 5 + 14 * hitIntensity;
        controls.start({
            x: [0, -amp, amp, -amp * 0.5, amp * 0.5, 0],
            transition: { duration: 0.2 + 0.12 * hitIntensity },
        });
    }, [hitKey, hitIntensity, controls]);

    // Lunge toward the opposing spotlight: player = up-right, enemy = down-left.
    const lungeKey = fx?.lungeKey ?? 0;
    useEffect(() => {
        if (!lungeKey || prefersReducedMotion()) return;
        const dx = isEnemy ? -34 : 34;
        const dy = isEnemy ? 20 : -20;
        controls.start({
            x: [0, dx, 0],
            y: [0, dy, 0],
            transition: { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' },
        });
    }, [lungeKey, isEnemy, controls]);

    const showArt = !!entity.artReference && !artBroken;

    return (
        <motion.div
            className={`stage-sprite-frame ${isDead ? 'stage-sprite-dead' : ''} ${deathGlitch ? 'stage-death-glitch' : ''}`}
            animate={controls}
        >
            {showArt ? (
                <img
                    src={new URL(`../../assets/battleArt/mingming/${entity.artReference}`, import.meta.url).href}
                    alt={entity.name}
                    className="stage-art"
                    draggable={false}
                    style={{
                        transform: isEnemy ? 'scaleX(-1)' : 'none',
                        filter: `drop-shadow(0 0 18px ${accent}44) drop-shadow(0 10px 14px rgba(0,0,0,0.7))`,
                    }}
                    onError={() => setArtBroken(true)}
                />
            ) : (
                <div
                    className="stage-art-disc"
                    style={{
                        color: accent,
                        borderColor: `${accent}88`,
                        background: `radial-gradient(circle at 38% 32%, ${accent}55 0%, ${accent}22 45%, rgba(8,8,14,0.9) 100%)`,
                        boxShadow: `0 0 30px ${accent}33, inset 0 0 24px ${accent}22`,
                    }}
                >
                    {entity.primaryElement[0]}
                </div>
            )}

            {/* Shared event-driven FX (same descriptors as the sidebar HUD card) */}
            <FxTransientOverlays fx={fx} />
            <FxFloats fx={fx} rise={120} slotSpacing={24} />
            <TerminatedStamp visible={isDead} glitching={deathGlitch} />
        </motion.div>
    );
};

interface BattleStageProps {
    battleState: IBattleState;
    selectedSourceId: string | null;
    selectedTargetId: string | null;
    /**
     * Ticket 22: the spotlights are drop surfaces too, so they owe the player the same
     * before-you-commit verdict the sidebar HUD cards give. Passed in rather than read from the
     * store because this component is deliberately store-free (see BattleStage.test-less design —
     * every input is a prop, which is what lets `BattleArena` own all the targeting policy).
     */
    selectedCardId?: string | null;
    /** Hovered entity while drag-targeting (mirrors the sidebar hover state). */
    hoveredEntityId: string | null;
    isTargeting: boolean;
    unitFx: Record<string, UnitFx>;
    onEntityClick: (entity: IBattleEntity, isEnemy: boolean) => void;
    onEntityPointerUp: (entity: IBattleEntity, isEnemy: boolean) => void;
    onEnemyHoverChange: (entityId: string | null) => void;
}

const BattleStage: React.FC<BattleStageProps> = ({
    battleState,
    selectedSourceId,
    selectedTargetId,
    selectedCardId,
    hoveredEntityId,
    isTargeting,
    unitFx,
    onEntityClick,
    onEntityPointerUp,
    onEnemyHoverChange,
}) => {
    const reduced = prefersReducedMotion();
    const { playerParty, enemyParty } = battleState;

    // LEFT SPOTLIGHT: the selected player unit, else the first living one.
    const player =
        playerParty.find(p => p.id === selectedSourceId) ??
        playerParty.find(p => p.currentHp > 0) ??
        playerParty[0];

    // RIGHT SPOTLIGHT: hovered target while targeting > selected target > first living.
    const hoveredEnemy = hoveredEntityId ? enemyParty.find(e => e.id === hoveredEntityId) : undefined;
    const enemy =
        hoveredEnemy ??
        enemyParty.find(e => e.id === selectedTargetId) ??
        enemyParty.find(e => e.currentHp > 0) ??
        enemyParty[0];

    if (!player || !enemy) return null;

    const playerAccent = getElementAccent(player.primaryElement);
    const enemyAccent = getElementAccent(enemy.primaryElement);
    const enemyIsTargeted = selectedTargetId === enemy.id;

    // Ticket 22: the same verdict, from the same predicate, that the sidebar cards draw. Both
    // spotlights get one, because either can be dropped on and either can refuse.
    const selectedCard = selectedCardId
        ? battleState.playerDeck.hand.find(c => c.id === selectedCardId)
        : undefined;
    const selectedCardData = selectedCard ? GetProgramData(selectedCard.dataId) : null;
    const caster = selectedSourceId
        ? battleState.playerParty.find(p => p.id === selectedSourceId) ?? null
        : null;
    const playerVerdict = selectedCardData ? targetVerdict(selectedCardData, player, false, caster) : null;
    const enemyVerdict = selectedCardData ? targetVerdict(selectedCardData, enemy, true, caster) : null;

    const swapTransition = { duration: reduced ? 0 : SWAP_DURATION, ease: 'easeOut' as const };

    return (
        <div className="battle-stage" data-testid="battle-stage">
            {/* ── LEFT SPOTLIGHT: selected player unit (back-sprite position) ── */}
            <div
                className={`stage-spot stage-spot-player ${playerVerdict ? (playerVerdict.ok ? 'stage-spot-legal' : 'stage-spot-illegal') : ''}`}
                data-testid="stage-spot-player"
                title={playerVerdict?.reason ?? undefined}
                onClick={() => onEntityClick(player, false)}
                onPointerUp={() => onEntityPointerUp(player, false)}
            >
                {playerVerdict && (
                    <div className={`stage-target-flag ${playerVerdict.ok ? 'legal' : 'illegal'}`}>
                        {playerVerdict.ok ? '✓ TARGET' : playerVerdict.reason}
                    </div>
                )}
                <div
                    className="stage-platform"
                    style={{
                        background: `radial-gradient(ellipse at center, ${playerAccent}30 0%, ${playerAccent}14 45%, transparent 72%)`,
                        borderColor: `${playerAccent}2e`,
                        boxShadow: selectedSourceId === player.id ? `0 0 24px ${playerAccent}33` : 'none',
                    }}
                >
                    <div className="stage-platform-grid" />
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={player.id}
                        className="stage-swap-wrap"
                        initial={{ opacity: 0, x: reduced ? 0 : -28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: reduced ? 0 : 20 }}
                        transition={swapTransition}
                    >
                        <StageSprite entity={player} isEnemy={false} fx={unitFx[player.id]} />
                    </motion.div>
                </AnimatePresence>
                <div className="stage-plaque" style={{ borderColor: `${playerAccent}55` }}>
                    <div className="stage-plaque-name">
                        <span className="stage-plaque-dot" style={{ background: playerAccent, boxShadow: `0 0 6px ${playerAccent}` }} />
                        {player.name.toUpperCase()}
                    </div>
                    <div className="stage-plaque-row">
                        <span className="stage-plaque-label">HP</span>
                        <StageBar percent={(player.currentHp / player.maxHp) * 100} color={getHpColor((player.currentHp / player.maxHp) * 100)} />
                        <span className="stage-plaque-value">{player.currentHp}/{player.maxHp}</span>
                    </div>
                    <div className="stage-plaque-row">
                        <span className="stage-plaque-label">EP</span>
                        <StageBar percent={(player.currentEnergy / Math.max(player.maxEnergy, player.currentEnergy)) * 100} color="#ffcc00" glow={player.currentEnergy > player.maxEnergy} />
                        <span className="stage-plaque-value">{player.currentEnergy}/{player.maxEnergy}</span>
                    </div>
                </div>
            </div>

            {/* ── RIGHT SPOTLIGHT: focus enemy (front-sprite position) ── */}
            <div
                className={`stage-spot stage-spot-enemy ${enemyIsTargeted ? 'stage-spot-targeted' : ''} ${enemyVerdict ? (enemyVerdict.ok ? 'stage-spot-legal' : 'stage-spot-illegal') : ''}`}
                data-testid="stage-spot-enemy"
                title={enemyVerdict?.reason ?? undefined}
                onClick={() => onEntityClick(enemy, true)}
                onPointerUp={() => onEntityPointerUp(enemy, true)}
                onMouseEnter={() => { if (isTargeting) onEnemyHoverChange(enemy.id); }}
                onMouseLeave={() => { if (hoveredEntityId === enemy.id) onEnemyHoverChange(null); }}
            >
                {enemyVerdict && (
                    <div className={`stage-target-flag ${enemyVerdict.ok ? 'legal' : 'illegal'}`}>
                        {enemyVerdict.ok ? '✓ TARGET' : enemyVerdict.reason}
                    </div>
                )}
                {enemy.currentIntent && enemy.currentHp > 0 && (
                    <motion.div
                        key={`${enemy.id}-${enemy.currentIntent.name}`}
                        className="stage-intent-chip"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={swapTransition}
                    >
                        <span className="stage-intent-icon">{intentIcon(enemy.currentIntent.intentType)}</span>
                        {enemy.currentIntent.name.toUpperCase()}
                    </motion.div>
                )}
                <div className="stage-plaque stage-plaque-enemy" style={{ borderColor: `${enemyAccent}55` }}>
                    <div className="stage-plaque-name">
                        <span className="stage-plaque-dot" style={{ background: enemyAccent, boxShadow: `0 0 6px ${enemyAccent}` }} />
                        {enemy.name.toUpperCase()}
                    </div>
                    <div className="stage-plaque-row">
                        <span className="stage-plaque-label">HP</span>
                        <StageBar percent={(enemy.currentHp / enemy.maxHp) * 100} color={getHpColor((enemy.currentHp / enemy.maxHp) * 100)} />
                        <span className="stage-plaque-value">{enemy.currentHp}/{enemy.maxHp}</span>
                    </div>
                </div>
                <div
                    className="stage-platform stage-platform-enemy"
                    style={{
                        background: `radial-gradient(ellipse at center, ${enemyAccent}30 0%, ${enemyAccent}14 45%, transparent 72%)`,
                        borderColor: `${enemyAccent}2e`,
                        boxShadow: enemyIsTargeted ? '0 0 24px rgba(239, 68, 68, 0.35)' : 'none',
                    }}
                >
                    <div className="stage-platform-grid" />
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={enemy.id}
                        className="stage-swap-wrap"
                        initial={{ opacity: 0, x: reduced ? 0 : 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: reduced ? 0 : -20 }}
                        transition={swapTransition}
                    >
                        <StageSprite entity={enemy} isEnemy fx={unitFx[enemy.id]} />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default BattleStage;
