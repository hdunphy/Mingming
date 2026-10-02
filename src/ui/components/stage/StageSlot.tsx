/**
 * ONE SLOT — ticket 145a, rebuilt in 183b: the platform, the sprite (with the caster cursor over it
 * and the target feedback under it), and the plaque outside it.
 *
 * The platform is drawn from the sprite's own box rather than being a sibling with its own
 * coordinates, so a sprite and its platform can never drift apart at a non-reference scale.
 */
import React from 'react';

import type { IBattleEntity, IBattleState } from '../../../engine/types';
import type { UnitFx } from '../../hooks/useBattleVfx';
import type { DamagePreview } from '../../utils/damagePreview';
import type { TargetVerdict } from '../../utils/targeting';
import type { StageRect } from '../stageGeometry';
import { CasterCursor } from './CasterCursor';
import { Platform } from './Platform';
import { StageSprite } from './StageSprite';
import { TargetFlag } from './TargetFlag';
import { UnitPlaque } from './UnitPlaque';

export interface StageSlotProps {
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
    battleState: IBattleState;
    onClick: () => void;
    onPointerUp: () => void;
    onHoverChange: (hovering: boolean) => void;
}

export const StageSlot: React.FC<StageSlotProps> = ({
    entity, isEnemy, rect, plaque, scale, isActive, isTargeted, verdict, preview, fx, battleState,
    onClick, onPointerUp, onHoverChange,
}) => {
    // A legal target the pointer is on (or the chosen one) shows the cursor; the words come with the
    // hover, when the preview knows the effectiveness.
    const effectiveness = preview ? preview.effectiveness : isTargeted ? 1 : null;
    return (
        <>
            <Platform rect={rect} active={isActive} enemy={isEnemy} />
            {isActive && <CasterCursor rect={rect} scale={scale} />}
            <div
                className={[
                    'stage-slot',
                    isEnemy ? 'stage-slot-enemy stage-enemy-shift' : 'stage-slot-ally',
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
                {verdict && <TargetFlag verdict={verdict} effectiveness={effectiveness} />}
                <StageSprite entity={entity} isEnemy={isEnemy} fx={fx} width={rect.w} />
            </div>
            <UnitPlaque
                entity={entity}
                isEnemy={isEnemy}
                plaque={plaque}
                scale={scale}
                isActive={isActive}
                preview={preview}
                battleState={battleState}
            />
        </>
    );
};
