/**
 * THE REWARD CARD — ticket 183c (D2: *everywhere the full card is shown takes this face*).
 *
 * The post-battle pick, the gym-clear draft and the synthesis celebration drew `ProgramCard`, a
 * fourth chassis nobody else used. They draw the one `CardFace` now, at the reward row's size, with
 * the picked card wearing the same yellow ring as a selected card in a hand.
 */
import React from 'react';

import { numericBaseCost, type ProgramData } from '../../engine/types';
import { CardFace } from '../screens/CardChassis';
import { colorFor } from '../screens/runShell';
import { shortTargetLabel } from '../utils/targeting';

const REWARD_TILE = { ['--cw' as string]: '164px', ['--ch' as string]: '214px', ['--ah' as string]: '48px' };

const RewardCardFace: React.FC<{ data: ProgramData; isSelected?: boolean }> = ({ data, isSelected }) => (
    <div
        className="rs-card reward-card"
        data-selected={isSelected ? 'true' : undefined}
        style={{ ...REWARD_TILE, ['--el' as string]: colorFor(data.element ?? 'None') } as React.CSSProperties}
    >
        <CardFace
            face={{
                name: data.name,
                description: data.description ?? '',
                element: data.element ?? 'None',
                cost: numericBaseCost(data.baseCost),
                dataId: data.id,
            }}
            target={shortTargetLabel(data)}
        />
    </div>
);

export default RewardCardFace;
