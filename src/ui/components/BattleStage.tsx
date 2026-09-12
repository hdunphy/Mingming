import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { UnitFx } from '../hooks/useBattleVfx';
import { FxTransientOverlays, FxFloats, TerminatedStamp } from './UnitFxLayer';
import { getElementAccent } from '../utils/contrastText';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { GetProgramData } from '../../engine/data/programRegistry';
import { targetVerdict, type TargetVerdict } from '../utils/targeting';
import { useStageAnchors } from '../hooks/useStageAnchors';
import ParticleLayer from '../vfx/ParticleLayer';
import { spriteWidthAt, SPRITE_H, SPRITE_W, type StageRect } from './stageGeometry';
import { StatusBadgeRow, PLAQUE_STATUS_BUDGET } from './StatusBadges';
import { DaemonTags, FirmwareChip, UnitPreview } from './UnitReadouts';
import type { DamagePreview } from '../utils/damagePreview';
import { computeDamagePreview } from '../utils/damagePreview';

/**
 * BATTLE STAGE — the stagger stage. Ticket 145a.
 *
 * # WHAT THIS REPLACED, AND WHY IT IS NOT COMING BACK
 *
 * Until 145 this was two SPOTLIGHTS: one huge active ally lower-left, one focus enemy upper-right,
 * with the other four units living only as HUD cards in two sidebars. Henry rejected it in three
 * words — *"the active Mingming is really awkward"* — and rejected the obvious alternative in the
 * same breath: *"we need vertical spacing for the Mingmings, otherwise the card draw becomes an
 * issue."* Horizontal rows leave nowhere for the fan to open.
 *
 * So: both parties as three-row columns, plaques on the OUTSIDE of each column, and the ~300px
 * between them left empty as the reveal lane. Every unit is on the board at all times; nothing is
 * promoted or demoted as the turn moves. The only thing that moves is the ACTIVE ally, which steps
 * 60px toward the centre — a step rather than a resize, so the composition holds still.
 *
 * # THE GEOMETRY IS NOT IN THIS FILE
 *
 * Every rectangle comes from `stageGeometry`, and `useStageAnchors` turns it into viewport pixels.
 * That indirection is ticket 145 §3: the slots are a published interface that ticket 146 fires
 * particles at, and its guarantee is that a slot does not move on selection, on a death, or on a
 * change of hand size. A layout in JSX cannot promise that; a pure module tested against the mock
 * can. See `stageGeometry.test.ts`.
 *
 * # WHAT 145a DELIBERATELY DOES NOT DO
 *
 * The plaque here is the SHAPE — name, HP, EP — at its final position and size. Status badges,
 * the active-ally rim light and the dead silhouette are 145b; the top bar is 145c; the console and
 * the fan are 145d/e; the reveal lane's card is 145f. This row is the skeleton those hang on, and
 * it ships alone so the geometry can be screenshotted and argued with before anything decorates it.
 */

const getHpColor = (percent: number) => {
    if (percent < 25) return '#ef4444';
    if (percent < 50) return '#ff8c00';
    return '#22c55e';
};

/** Slim HP bar. The plaque is 168px wide at the reference size and the bar is 6px tall (§2b). */
const StageBar: React.FC<{ percent: number; color: string }> = ({ percent, color }) => (
    <div className="stage-bar-track">
        <motion.div
            className="stage-bar-fill"
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ background: color }}
        />
    </div>
);

interface StageSpriteProps {
    entity: IBattleEntity;
    isEnemy: boolean;
    fx?: UnitFx;
    width: number;
    /** The acting ally. Ticket 145b gives it a rim light in its element colour. */
    isActive: boolean;
}

/**
 * One sprite and its event-driven FX. Unchanged in substance from the spotlight version — the
 * hit shake, the lunge and the death glitch are the same descriptors the HUD card used, so a unit
 * that moved from a sidebar onto the stage kept its whole feedback vocabulary. What changed is that
 * six of these exist at once, so the frame takes its size from the caller rather than from CSS.
 */
const StageSprite: React.FC<StageSpriteProps> = ({ entity, isEnemy, fx, width, isActive }) => {
    const controls = useAnimation();
    const [deathGlitch, setDeathGlitch] = React.useState(false);
    const [artBroken, setArtBroken] = React.useState(false);
    const prevHpRef = React.useRef(entity.currentHp);
    const isDead = entity.currentHp <= 0;
    const accent = getElementAccent(entity.primaryElement);

    useEffect(() => {
        // ticket 55: reviewed, not a defect. "Reset state when a prop changes"; the `key` React
        // would prefer would remount animation state that must outlive an art swap.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setArtBroken(false);
    }, [entity.artReference]);

    useEffect(() => {
        if (entity.currentHp <= 0 && prevHpRef.current > 0) {
            // ticket 55: reviewed. A 500ms one-shot owned by a timer, fired on an HP crossing only
            // a ref can see.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDeathGlitch(true);
            const timeout = setTimeout(() => setDeathGlitch(false), 500);
            prevHpRef.current = entity.currentHp;
            return () => clearTimeout(timeout);
        }
        prevHpRef.current = entity.currentHp;
    }, [entity.currentHp]);

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

    // Lunge toward the reveal lane: an ally moves right, an enemy left. Purely horizontal now that
    // the columns face each other across the lane — the spotlight version's diagonal was aiming at
    // a sprite that sat in a corner.
    const lungeKey = fx?.lungeKey ?? 0;
    useEffect(() => {
        if (!lungeKey || prefersReducedMotion()) return;
        controls.start({
            x: [0, isEnemy ? -34 : 34, 0],
            transition: { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' },
        });
    }, [lungeKey, isEnemy, controls]);

    const showArt = !!entity.artReference && !artBroken;
    const height = width * (SPRITE_H / SPRITE_W);

    return (
        <motion.div
            className={`stage-sprite-frame ${isDead ? 'stage-sprite-dead' : ''} ${deathGlitch ? 'stage-death-glitch' : ''}`}
            animate={controls}
            style={{ width, height }}
        >
            {showArt ? (
                <img
                    src={new URL(`../../assets/battleArt/mingming/${entity.artReference}`, import.meta.url).href}
                    alt={entity.name}
                    className="stage-art"
                    draggable={false}
                    style={{
                        transform: isEnemy ? 'scaleX(-1)' : 'none',
                        /*
                         * TICKET 145b — THREE STATES IN ONE FILTER, in priority order.
                         *
                         * Dead wins over active (a corpse does not glow), and active wins over
                         * resting. The rim light is a second, tighter drop-shadow in the element
                         * colour rather than a border or an outline: it follows the sprite's own
                         * silhouette, which a box around a transparent PNG cannot.
                         *
                         * The dead state is §2b's "40%-brightness silhouette" as a FILTER rather
                         * than an opacity, deliberately — opacity would fade the TERMINATED stamp
                         * with it, and ticket 34 already settled that the stamp keeps its neon red.
                         */
                        filter: isDead
                            ? 'brightness(0.4) saturate(0.35) drop-shadow(0 10px 14px rgba(0,0,0,0.7))'
                            : isActive
                                ? `drop-shadow(0 0 8px ${accent}) drop-shadow(0 0 22px ${accent}66) drop-shadow(0 10px 14px rgba(0,0,0,0.7))`
                                : `drop-shadow(0 0 18px ${accent}44) drop-shadow(0 10px 14px rgba(0,0,0,0.7))`,
                    }}
                    onError={() => setArtBroken(true)}
                />
            ) : (
                <div
                    className="stage-art-disc"
                    style={{
                        color: accent,
                        borderColor: isActive ? accent : `${accent}88`,
                        background: `radial-gradient(circle at 38% 32%, ${accent}55 0%, ${accent}22 45%, rgba(8,8,14,0.9) 100%)`,
                        // The art-less fallback earns the same three states, or a species without a
                        // sprite yet would be the one unit on the board that never looks active.
                        boxShadow: isDead
                            ? 'none'
                            : isActive
                                ? `0 0 14px ${accent}, inset 0 0 24px ${accent}33`
                                : `0 0 30px ${accent}33, inset 0 0 24px ${accent}22`,
                        filter: isDead ? 'brightness(0.4) saturate(0.35)' : undefined,
                    }}
                >
                    {entity.primaryElement[0]}
                </div>
            )}

            <FxTransientOverlays fx={fx} />
            <FxFloats fx={fx} rise={120} slotSpacing={24} />
            <TerminatedStamp visible={isDead} glitching={deathGlitch} />
        </motion.div>
    );
};

interface SlotProps {
    entity: IBattleEntity;
    isEnemy: boolean;
    rect: StageRect;
    plaque: StageRect;
    scale: number;
    isActive: boolean;
    isTargeted: boolean;
    verdict: TargetVerdict | null;
    /** Ticket 145b: what the held card would do to this unit. Null unless it is the hover target. */
    preview: DamagePreview | null;
    fx?: UnitFx;
    onClick: () => void;
    onPointerUp: () => void;
    onHoverChange: (hovering: boolean) => void;
}

/**
 * One slot: the floor glow, the sprite, and the plaque outside it.
 *
 * The floor is drawn from the sprite's own box rather than being a sibling with its own
 * coordinates, so a sprite and its shadow can never drift apart at a non-reference scale. The mock
 * puts it 22px left of the sprite and 94px down, 195x26 — all four numbers scale together here.
 */
const StageSlot: React.FC<SlotProps> = ({
    entity, isEnemy, rect, plaque, scale, isActive, isTargeted, verdict, preview, fx,
    onClick, onPointerUp, onHoverChange,
}) => {
    const accent = getElementAccent(entity.primaryElement);
    const hpPercent = (entity.currentHp / entity.maxHp) * 100;
    const isDead = entity.currentHp <= 0;
    const pipCount = Math.max(entity.maxEnergy, entity.currentEnergy);
    const previewDamage = preview?.damage ?? 0;

    return (
        <>
            <div
                className="stage-floor"
                style={{
                    // Derived from the DRAWN sprite box, not from the reference: past 1280 the
                    // sprite caps at 190 while its slot keeps growing, so a floor sized off the
                    // reference would sit wider than the thing casting it.
                    left: rect.x - rect.w * (22 / SPRITE_W),
                    top: rect.y + rect.h * (94 / SPRITE_H),
                    width: rect.w * (195 / SPRITE_W),
                    height: rect.h * (26 / SPRITE_H),
                    background: `radial-gradient(ellipse at center, ${isEnemy ? accent : '#7c3aed'}44, transparent 70%)`,
                }}
            />
            <div
                className={[
                    'stage-slot',
                    isEnemy ? 'stage-slot-enemy' : 'stage-slot-ally',
                    isActive ? 'stage-slot-active' : '',
                    isTargeted ? 'stage-slot-targeted' : '',
                    verdict ? (verdict.ok ? 'stage-slot-legal' : 'stage-slot-illegal') : '',
                ].filter(Boolean).join(' ')}
                data-testid={`stage-slot-${entity.id}`}
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                title={verdict?.reason ?? undefined}
                onClick={onClick}
                onPointerUp={onPointerUp}
                onMouseEnter={() => onHoverChange(true)}
                onMouseLeave={() => onHoverChange(false)}
            >
                {verdict && (
                    <div className={`stage-target-flag ${verdict.ok ? 'legal' : 'illegal'}`}>
                        {verdict.ok ? '✓ TARGET' : verdict.reason}
                    </div>
                )}
                <StageSprite entity={entity} isEnemy={isEnemy} fx={fx} width={rect.w} isActive={isActive} />
            </div>

            <div
                className={`stage-plaque ${isActive ? 'stage-plaque-active' : ''} ${isDead ? 'stage-plaque-dead' : ''}`}
                data-testid={`stage-plaque-${entity.id}`}
                style={{
                    left: plaque.x,
                    top: plaque.y,
                    width: plaque.w,
                    fontSize: 11 * scale,
                    borderColor: isActive ? `${accent}b3` : undefined,
                }}
            >
                <div className="stage-plaque-name">
                    <span className="stage-plaque-dot" style={{ background: accent }} />
                    <span className="stage-plaque-name-text">{entity.name.toUpperCase()}</span>
                    {/*
                      * The firmware chip rides the name row: it is the shortest of the three
                      * readouts Henry asked back in, and the name is the only line with room
                      * beside it. `.stage-plaque-name-text` can ellipsis so the chip never gets
                      * pushed off the plaque by a long species name.
                      */}
                    <FirmwareChip entity={entity} />
                </div>
                <div className="stage-plaque-row">
                    <StageBar percent={hpPercent} color={getHpColor(hpPercent)} />
                    <span className="stage-plaque-value">
                        {entity.currentHp}/{entity.maxHp}
                        {previewDamage > 0 && <span className="stage-plaque-preview-hp"> (-{previewDamage})</span>}
                    </span>
                </div>
                <div className="stage-plaque-row">
                    <span className="stage-plaque-pips">
                        {Array.from({ length: pipCount }, (_, i) => (
                            <i key={i} className={i < entity.currentEnergy ? '' : 'off'} />
                        ))}
                    </span>
                    <span className="stage-plaque-value">{entity.currentEnergy}/{entity.maxEnergy} EP</span>
                </div>
                {/*
                  * TICKET 145b — the statuses come to the plaque. Same chip and same tooltip the
                  * HUD card draws (`StatusBadges`), because a player learns one vocabulary rather
                  * than two; only the budget differs, and it differs because the two rows are
                  * different widths.
                  *
                  * `pointer-events` are re-enabled on the row alone: the plaque is inert so it can
                  * never eat a drag aimed at the sprite behind it, but a badge whose tooltip cannot
                  * be hovered is a badge that has stopped explaining itself.
                  */}
                <StatusBadgeRow
                    statuses={entity.statusEffects}
                    budget={PLAQUE_STATUS_BUDGET}
                    className="hud-status-badges stage-plaque-statuses"
                />
                {/*
                  * The daemons get their own row rather than sharing the status line: a daemon is
                  * named, not iconified, and a word does not share 152px with four badges.
                  */}
                <DaemonTags entity={entity} className="hud-daemons-row stage-plaque-daemons" />
                {/*
                  * ABSOLUTE, not in the plaque's flow, and that is load-bearing rather than
                  * cosmetic. The preview appears and disappears as the pointer crosses a target;
                  * a plaque that changed height on hover would shift everything under it on a
                  * board where ticket 145 §3 promises the geometry holds still. The HUD card could
                  * afford that reflow — a sidebar column has nothing depending on its rows — and
                  * the stage cannot.
                  */}
                {preview && (
                    <div className="stage-plaque-preview">
                        <UnitPreview preview={preview} className="hud-preview-tags stage-preview-row" />
                    </div>
                )}
            </div>
        </>
    );
};

interface BattleStageProps {
    battleState: IBattleState;
    selectedSourceId: string | null;
    selectedTargetId: string | null;
    /** Ticket 22: a slot is a drop surface, so it owes the player the same before-you-commit verdict. */
    selectedCardId?: string | null;
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
    const { playerParty, enemyParty } = battleState;

    /*
     * WHO STEPS. The active ally is the SELECTED caster, and falls back to the first living body
     * when nothing is selected — never to a hover. §3 requires the slots to hold still under the
     * pointer, and a step that followed the mouse would be exactly the drift 146 caches against.
     */
    const activeAllyIndex = (() => {
        const selected = playerParty.findIndex(p => p.id === selectedSourceId && p.currentHp > 0);
        if (selected >= 0) return selected;
        return playerParty.findIndex(p => p.currentHp > 0);
    })();

    /*
     * The backdrop takes the BIOME's element, not the active unit's: it is the room, and a room
     * that changed colour when you selected a different ally would be reporting the wrong thing.
     * Falls back to the stage's own violet outside a run, where there is no biome.
     */
    const biomeName = (battleState as unknown as { biomeName?: string }).biomeName ?? null;
    const biomeColor = getElementAccent((battleState as unknown as { biomeElement?: string }).biomeElement ?? 'None');

    const anchors = useStageAnchors(battleState, activeAllyIndex);
    const spriteW = spriteWidthAt(anchors.scale);

    // The same verdict predicate the HUD cards drew, now asked once per slot.
    const selectedCard = selectedCardId
        ? battleState.playerDeck.hand.find(c => c.id === selectedCardId)
        : undefined;
    const selectedCardData = selectedCard ? GetProgramData(selectedCard.dataId) : null;
    const caster = selectedSourceId
        ? playerParty.find(p => p.id === selectedSourceId) ?? null
        : null;

    const renderSide = (party: ReadonlyArray<IBattleEntity>, isEnemy: boolean) =>
        party.map((entity, index) => {
            const slot = anchors.slots[entity.id];
            const plaque = anchors.plaques[entity.id];
            if (!slot || !plaque) return null;
            // The cap is applied here rather than in the anchors: 146 wants the SLOT, which is the
            // area the unit owns, while the drawn sprite may be smaller than its slot at 1920.
            const rect: StageRect = { ...slot, w: spriteW, h: spriteW * (SPRITE_H / SPRITE_W) };
            return (
                <StageSlot
                    key={entity.id}
                    entity={entity}
                    isEnemy={isEnemy}
                    rect={rect}
                    plaque={plaque}
                    scale={anchors.scale}
                    isActive={!isEnemy && index === activeAllyIndex}
                    isTargeted={selectedTargetId === entity.id}
                    verdict={selectedCardData ? targetVerdict(selectedCardData, entity, isEnemy, caster) : null}
                    // Computed for the HOVER TARGET only, exactly as the HUD card did it: the
                    // preview simulates the play, so asking for six of them every render would be
                    // six speculative battles a frame to answer a question about one unit.
                    preview={
                        hoveredEntityId === entity.id && selectedCardId
                            ? computeDamagePreview(battleState, selectedSourceId, selectedCardId, entity.id)
                            : null
                    }
                    fx={unitFx[entity.id]}
                    onClick={() => onEntityClick(entity, isEnemy)}
                    onPointerUp={() => onEntityPointerUp(entity, isEnemy)}
                    onHoverChange={(hovering) => {
                        // BOTH sides, not just enemies. The HUD card set `isHoveredTarget` on any
                        // unit while a card was in hand, and it had to: an ally is a legal target
                        // for a heal or a buff, and the preview is the only thing that says how
                        // much before you let go. Gated on `isTargeting` so an idle mouse crossing
                        // the board does not simulate a play per unit it passes.
                        if (hovering && isTargeting) onEnemyHoverChange(entity.id);
                        else if (!hovering && hoveredEntityId === entity.id) onEnemyHoverChange(null);
                    }}
                />
            );
        });

    return (
        <div className="battle-stage" data-testid="battle-stage">
            {/*
              * TICKET 145f — THE BACKDROP MINIMUM. Not art (steam-release 33/34 owns that) and not
              * motion (146 owns that): the least that makes the stage read as a PLACE rather than a
              * dark rectangle with units on it. The biome name at 30%, three skewed shafts in its
              * element at 6-10%, a haze at the foot and a one-pixel ground line — all of it in the
              * biome's own colour, so the thing that changes between biomes is the thing the player
              * already tracks.
              */}
            <div className="stage-backdrop" style={{ ["--biome" as string]: biomeColor }}>
                <div className="stage-shaft" style={{ left: '33%' }} />
                <div className="stage-shaft" style={{ left: '44%', opacity: 0.6 }} />
                <div className="stage-shaft" style={{ left: '59%', opacity: 0.8 }} />
                <div className="stage-haze" />
                <div className="stage-ground" />
                {biomeName && <div className="stage-biome-name">{biomeName}</div>}
            </div>
            {renderSide(playerParty, false)}
            {renderSide(enemyParty, true)}
            {/*
              * TICKET 146a — THE PARTICLE LAYER, LAST IN THE STAGE.
              *
              * Last so it paints over the sprites without a z-index fight: flames that render
              * behind the body they come off are the one arrangement that reads as a bug. It sits
              * INSIDE `.battle-stage` because that is where the anchors' coordinate space is
              * already correct and where the layer dies with the fight.
              *
              * It is NOT handed the battle state, and that is the ruling rather than an oversight:
              * §1.3 rules out persistent status emitters, so the layer draws events and never
              * conditions. A component that could see the state would drift back toward polling it.
              */}
            <ParticleLayer anchors={anchors} />
        </div>
    );
};

export default BattleStage;
