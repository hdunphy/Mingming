/**
 * THE TARGET TAG — ticket 183c. Where the card may land, as an icon on a small navy plate under the
 * art. The words are the hover and the screen-reader text (182a: an icon, not "ENEMY"/"SELF"); the
 * long phrase for the tooltip stays `describeLegalTargets`'s.
 */
import type { ReactElement } from 'react';

import { Icon } from '../../theme/Icon';
import { targetIconOf } from './targetIcon';

export function TargetTag({ target }: { readonly target: string | undefined }): ReactElement | null {
    const icon = target ? targetIconOf(target) : null;
    if (!target || !icon) return null;
    const label = `Targets: ${target.toLowerCase()}`;
    return (
        <span className="rs-tgtrow">
            <span className="k-slant rs-tgt" title={label} aria-label={label}>
                <Icon name={icon} size={11} />
            </span>
        </span>
    );
}
