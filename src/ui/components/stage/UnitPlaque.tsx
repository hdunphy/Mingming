/**
 * THE MONSTER'S PLAQUE — ticket 183b. Name, element badge and firmware gear on the top row; the HP
 * bar with `cur/max` under it; the energy hexagon `n/max` and the status chips under that; the
 * named daemons last. A navy slanted panel with the element's slash on the face that looks at the
 * monster (right for an ally, left for an enemy).
 *
 * # WHAT DID NOT MOVE
 *
 * 145's geometry. The plaque sits where `plaqueRect` puts it, at its reference 168px, and is scaled
 * as one piece from its top-left corner, so every pixel size below is a reference-scale number and
 * the plaque's far edge lands where the geometry says it does. Same test ids, same tooltips.
 *
 * # BARK SHIELD
 *
 * It is the brown band on the HP bar, not a chip (Henry, 2026-10-02). `StatusChipRow` leaves it out.
 *
 * # THE PREVIEW IS OUT OF FLOW, AND OUTSIDE THE CLIP
 *
 * It appears and disappears as the pointer crosses a target, so a plaque that grew on hover would
 * shift everything under it on a board whose geometry holds still (145 §3). It is a sibling of the
 * panel rather than a child because the panel's slanted `clip-path` would cut it off.
 */
import React from 'react';

import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { ElementBadge } from '../../theme/kit/ElementBadge';
import { EnergyHex } from '../../theme/kit/EnergyHex';
import { HpBar } from '../../theme/kit/HpBar';
import { SlantPanel } from '../../theme/kit/SlantPanel';
import type { DamagePreview } from '../../utils/damagePreview';
import { PLAQUE_W, type StageRect } from '../stageGeometry';
import { DaemonTags, FirmwareChip, UnitPreview } from '../UnitReadouts';
import { useDisplayedUnit } from '../../vfx/displayed/useDisplayedBoard';
import { PlaqueHpPreview } from './PlaqueHpPreview';
import type { TargetMark } from './targetMark';
import { StatusChipRow } from './StatusChipRow';

/** The HP bar's track width at reference scale: what is left of the plaque beside `414/1125`. */
const PLAQUE_HP_W = 74;
const PLAQUE_HEX = 20;

export interface UnitPlaqueProps {
    readonly entity: IBattleEntity;
    readonly isEnemy: boolean;
    readonly plaque: StageRect;
    readonly scale: number;
    readonly isActive: boolean;
    /** What the held card would do to this unit. Null unless it is the hover target. */
    readonly preview: DamagePreview | null;
    /** 194h: the same mark as the sprite's, so the plaque and the body read as one target. */
    readonly mark?: TargetMark;
    /** 184c: the counters on the plaque (firmware, daemons) read the battle. */
    readonly battleState: IBattleState;
}

export const UnitPlaque: React.FC<UnitPlaqueProps> = ({
    entity, isEnemy, plaque, scale, isActive, preview, mark = null, battleState,
}) => {
    // TICKET 189c: what the player SEES moves at the impact, not when the engine resolved the card.
    // Targeting and the damage preview below keep reading the real entity.
    const shown = useDisplayedUnit(entity);
    const isDead = shown.isDown;
    const previewDamage = preview?.damage ?? 0;
    return (
        <div
            className={[
                'stage-plaque',
                isEnemy ? 'is-enemy stage-enemy-shift' : 'is-ally',
                isActive ? 'stage-plaque-active' : '',
                isDead ? 'stage-plaque-dead' : '',
                mark ? `stage-plaque-mark-${mark}` : '',
            ].filter(Boolean).join(' ')}
            data-testid={`stage-plaque-${entity.id}`}
            style={{ left: plaque.x, top: plaque.y, width: PLAQUE_W, transform: `scale(${scale})` }}
        >
            <SlantPanel cut={8} slash={isEnemy ? 'left' : 'right'} element={entity.primaryElement}>
                <div className="stage-plaque-body">
                    <div className="stage-plaque-name">
                        <span className="stage-plaque-name-text k-display">{entity.name}</span>
                        <div className="stage-plaque-marks">
                            <ElementBadge element={entity.primaryElement} />
                            {/*
                              * The firmware chip rides the name row: it is the shortest of the
                              * readouts and the name is the only line with room beside it, and the
                              * name is the item that gives up width (it ellipses).
                              */}
                            <FirmwareChip entity={entity} battleState={battleState} />
                        </div>
                    </div>
                    <div className="stage-plaque-row">
                        <HpBar
                            cur={shown.hp}
                            max={entity.maxHp}
                            width={PLAQUE_HP_W}
                            shield={shown.bark}
                            ghost={shown.ghost}
                        />
                        <span className="stage-plaque-value k-display">
                            {shown.hp}
                            <span className="stage-plaque-max">/{entity.maxHp}</span>
                        </span>
                    </div>
                    <div className="stage-plaque-row stage-plaque-lower">
                        <EnergyHex n={entity.currentEnergy} max={entity.maxEnergy} size={PLAQUE_HEX} />
                        <StatusChipRow statuses={entity.statusEffects} />
                    </div>
                    {/* A daemon is NAMED, not iconified, so it gets its own row. */}
                    <DaemonTags entity={entity} className="stage-plaque-daemons" battleState={battleState} />
                </div>
            </SlantPanel>
            {preview && (
                <div className="stage-plaque-preview">
                    {/* 194e: the HP number gets its own line out here, where the panel's clip cannot cut it. */}
                    <PlaqueHpPreview damage={previewDamage} />
                    <UnitPreview preview={preview} className="stage-preview-row" />
                </div>
            )}
        </div>
    );
};
