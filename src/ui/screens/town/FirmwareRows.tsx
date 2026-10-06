/**
 * TICKET 176c — the two firmware a blueprint's species can run, shown under the blueprint on the
 * Shop tab: the instinct's name, its one-line description and its start kit as rows with a card
 * peek on hover. Nothing is chosen here. The firmware is still picked at assembly (the Workshop).
 */
import type { ReactNode } from 'react';

import { getOSBehavior } from '../../../engine/data/firmwareRegistry';
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { START_KIT_SIZE, startKitIdsFor } from '../../../engine/run/createRun';
import { useCardPeek } from '../../hooks/useCardPeek';
import { instinctName, plain } from '../../labels/labels';
import { InstinctGlyph } from '../../components/InstinctGlyph';
import { CardPeek } from '../CardPeek';
import { ElementMark } from '../CardChassis';
import { cardFace, colorFor } from '../runShell';

export function FirmwareRows({ speciesId }: { readonly speciesId: string }): ReactNode {
    const { peek, at, peekHandlers } = useCardPeek();
    const definition = GetMingmingData(speciesId);

    return (
        <div className="mk-firmware" aria-label={`${definition.name}'s instincts`}>
            {definition.availableOS.map((osId) => {
                const os = getOSBehavior(osId);
                const kit = startKitIdsFor({ definitionId: speciesId, activeOS: osId }, START_KIT_SIZE);
                return (
                    <div key={osId} className="mk-fw" style={{ ['--el' as string]: colorFor(definition.primaryElement) }}>
                        <span className="mk-fw-nm"><InstinctGlyph instinct={osId} size={14} className="instinct-glyph-lead" />{instinctName(os?.name ?? osId)}</span>
                        <span className="mk-fw-desc">{plain(os?.description ?? 'No instinct description.')}</span>
                        <div className="rs-cards">
                            {kit.map((dataId, index) => {
                                const face = cardFace(dataId);
                                return (
                                    <div
                                        key={`${dataId}:${index}`}
                                        className="rs-row static"
                                        style={{ ['--el' as string]: colorFor(face.element) }}
                                        {...peekHandlers({ face })}
                                    >
                                        <span className="rs-g">{face.cost}</span>
                                        <ElementMark element={face.element} compact />
                                        <span className="rs-rnm">{face.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            <CardPeek peek={peek} at={at} className="fw-peek" />
        </div>
    );
}
