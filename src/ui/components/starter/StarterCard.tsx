/**
 * THE STARTER CARD — ticket 183f. A `CardFace`, the same one a card in the hand wears, with the
 * monster's three stats in the rules slot and its one line of flavour on the tag line. The caller
 * of a `CardFace` owns size and element, so this component is that caller: a real button, which
 * hands the keyboard (Enter and Space) to the browser, where the old div had to be taught it.
 */
import type { CSSProperties, ReactElement } from 'react';

import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { CardFace } from '../../screens/CardChassis';
import { colorFor } from '../../screens/runShell';
import { StarterArt } from '../StarterArt';
import { STARTER_FLAVOUR } from '../starterFlavour';
import { StarterStats } from './StarterStats';
import './starter.css';

export type StarterId = keyof typeof STARTER_FLAVOUR;

const SIZE = { ['--cw' as string]: '260px', ['--ch' as string]: '340px', ['--ah' as string]: '116px' };

export function StarterCard({ id, name, element, onSelect }: {
    readonly id: StarterId;
    readonly name: string;
    readonly element: string;
    readonly onSelect: () => void;
}): ReactElement {
    return (
        <button
            type="button"
            className="rs-card starter-card"
            style={{ ...SIZE, ['--el' as string]: colorFor(element) } as CSSProperties}
            onClick={onSelect}
            aria-label={`Choose ${name}, the ${element} starter`}
            data-testid={`starter-${id}`}
        >
            <CardFace
                face={{ name, description: '', element }}
                tags={STARTER_FLAVOUR[id]}
                rules={<StarterStats speciesId={id} />}
                art={<StarterArt artReference={GetMingmingData(id).artReference} name={name} />}
            />
        </button>
    );
}
