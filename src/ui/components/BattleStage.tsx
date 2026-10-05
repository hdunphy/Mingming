import React from 'react';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { UnitFx } from '../hooks/useBattleVfx';
import { GetProgramData } from '../../engine/data/programRegistry';
import { targetVerdict } from '../utils/targeting';
import { useStageAnchors, useViewportSize } from '../hooks/useStageAnchors';
import ParticleLayer from '../vfx/ParticleLayer';
import EnemyHandPanel from './EnemyHandPanel';
import { enemyShiftFor, spriteWidthAt, SPRITE_H, SPRITE_W, type StageRect } from './stageGeometry';
import { elementKey } from '../theme/kit/elementGlyphs';
import { computeDamagePreview } from '../utils/damagePreview';
import { BiomeBackdrop } from './stage/BiomeBackdrop';
import { StageSlot } from './stage/StageSlot';
import { targetHighlight } from './stage/targetHighlight';
import './stage/stage.css';

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
 *
 * TICKET 183b: the slot, the sprite and the plaque are components of their own in `./stage/`, drawn
 * in the Slant kit, and the backdrop is five flat biome bands. This file keeps what is genuinely the
 * stage's: the anchors, the active ally, the enemy-hand shift and the order things are painted in.
 */

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
    /** TICKET 182c: the intro has no enemy-hand tab. Absent, not just closed. */
    hideEnemyHand?: boolean;
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
    hideEnemyHand = false,
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
     * An element with no band set of its own, or no biome at all (a fight outside a run), draws the
     * Neutral set. The attribute goes on the stage root, not on the backdrop, because the platforms
     * under the bodies read `--ground-2` from the same set.
     *
     * TICKET 155, DEEP DIVE 6 — read off the state, not cast out of it: `biomeElement` is declared
     * on `IBattleState` and `startBattle` sets it. The biome's NAME moved to the top bar in 183b.
     */
    const biome = elementKey(battleState.biomeElement ?? 'None');

    /*
     * TICKET 167g — THE ENEMY HAND PANEL'S OPEN STATE LIVES HERE, because the enemies slide to meet
     * it. Henry, 2026-09-28: *"If the panel is open then push them towards the middle. If it is
     * closed make sure there isn't a gap of 'white space' between them."*
     *
     * The shift is a function of the window and of open/closed (`enemyShiftFor`), never of the
     * selection or the hand, so the anchors keep their §3 stability. A MOVES fight renders no panel,
     * so it takes the closed value and the enemies still sit tight to the right.
     */
    const [enemyHandOpen, setEnemyHandOpen] = React.useState(false);
    const viewport = useViewportSize();
    const enemyHasDeck = battleState.enemyMode === 'CARDS' && !hideEnemyHand;
    const enemyShiftX = enemyShiftFor(viewport.width, viewport.height, enemyHandOpen && enemyHasDeck);
    const anchors = useStageAnchors(battleState, activeAllyIndex, enemyShiftX);
    const spriteW = spriteWidthAt(anchors.scale);

    // The same verdict predicate the HUD cards drew, now asked once per slot.
    const selectedCard = selectedCardId
        ? battleState.playerDeck.hand.find(c => c.id === selectedCardId)
        : undefined;
    const selectedCardData = selectedCard ? GetProgramData(selectedCard.dataId) : null;
    const caster = selectedSourceId
        ? playerParty.find(p => p.id === selectedSourceId) ?? null
        : null;

    // TICKET 194h: who the held card is aimed at, once for the whole board. A unit the card cannot
    // land on is neither marked nor previewed, so the strong mark and the preview agree.
    const verdictOf = (entity: IBattleEntity, isEnemy: boolean) =>
        selectedCardData ? targetVerdict(selectedCardData, entity, isEnemy, caster) : null;
    const highlight = targetHighlight({
        card: selectedCardData,
        units: [
            ...playerParty.map((entity) => ({ id: entity.id, legal: verdictOf(entity, false)?.ok ?? false, isEnemy: false })),
            ...enemyParty.map((entity) => ({ id: entity.id, legal: verdictOf(entity, true)?.ok ?? false, isEnemy: true })),
        ],
        casterId: selectedSourceId,
        hoveredId: hoveredEntityId ?? null,
    });

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
                    verdict={verdictOf(entity, isEnemy)}
                    mark={highlight.strong.has(entity.id) ? 'strong' : highlight.soft.has(entity.id) ? 'soft' : null}
                    // Computed for the HOVER TARGET only, exactly as the HUD card did it: the
                    // preview simulates the play, so asking for six of them every render would be
                    // six speculative battles a frame to answer a question about one unit.
                    preview={
                        hoveredEntityId === entity.id && selectedCardId && (verdictOf(entity, isEnemy)?.ok ?? true)
                            ? computeDamagePreview(battleState, selectedSourceId, selectedCardId, entity.id)
                            : null
                    }
                    fx={unitFx[entity.id]}
                    battleState={battleState}
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
        <div className="battle-stage" data-testid="battle-stage" data-biome={biome}>
            {/*
              * TICKET 183b — five flat bands from the biome's token set. Not art (steam-release
              * 33/34 owns painted backdrops, which can replace this per biome without touching
              * layout) and not motion (146 owns that).
              */}
            <BiomeBackdrop />
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
            {/*
              * TICKET 159b — THE ENEMY'S HAND, ABOVE EVERYTHING ELSE ON THE STAGE.
              *
              * After the particle layer, so the tab and the panel are not painted over by a trail
              * that happens to cross them. §5's ruling is the other way round for a cast: *"a cast
              * in flight plays over them"* — and it does, because the reveal card and the cast lane
              * live in `BattleArena` above this whole element, not inside the stage.
              *
              * It takes the battle state and reads only `enemyDeck.hand` and the enemies' Energy.
              * Nothing is predicted here: no targets, no order — see the component's header for
              * why that line is the whole design.
              */}
            {!hideEnemyHand && (
                <EnemyHandPanel
                    battleState={battleState}
                    open={enemyHandOpen}
                    onToggle={() => setEnemyHandOpen((open) => !open)}
                />
            )}
        </div>
    );
};

export default BattleStage;
