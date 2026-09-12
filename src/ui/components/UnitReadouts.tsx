/**
 * UNIT READOUTS — the three things a unit says about itself beyond its bars.
 *
 * # WHY THEY ARE HERE (ticket 145b, second pass)
 *
 * The stagger stage replaced the sidebar HUD columns, and ticket 145's mock gave no home to three
 * things the HUD card carried: the FIRMWARE chip, the DAEMON tags, and the card PREVIEW with its
 * lethal marker. I shipped 145b with the columns still on rather than drop them silently, and Henry
 * ruled: *"We need to include those three things."*
 *
 * So they moved, and — as with `StatusBadges` — there is ONE implementation with one tooltip, used
 * by both the plaque and the HUD card. The alternative is two readouts of the same fact that drift,
 * and a player who has to learn which surface to believe.
 *
 * # WHAT THE PLAQUE DOES DIFFERENTLY, AND WHY
 *
 * Nothing about the CONTENT. What differs is placement, and only where the plaque's 168px forces it:
 *
 *  - The firmware chip sits on the NAME row, where it is a 34px chip beside a name that can
 *    ellipsis. On the HUD card it sits in the same place for the same reason.
 *  - The daemon tags get their own row under the statuses, because a daemon name is a word and a
 *    word does not share a line with four badges at 168px.
 *  - The preview is ABSOLUTELY positioned under the plaque rather than laid out in it. That is not
 *    cosmetic: the preview appears and disappears as the pointer moves over a target, and a plaque
 *    that changed height on hover would move every row below it on a board where ticket 145 §3
 *    promises the geometry holds still. The HUD card could afford the reflow; the stage cannot.
 */
import React from 'react';
import { createPortal } from 'react-dom';

import { GetProgramData } from '../../engine/data/programRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { getElementAccent } from '../utils/contrastText';
import { Icon } from '../theme/Icon';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import type { DamagePreview } from '../utils/damagePreview';
import { formatMultiplier } from './elementMatchups';
import { SCALING_LABEL } from './scalingLabels';
import type { IBattleEntity } from '../../engine/types';

/*
 * `SCALING_LABEL` and `formatMultiplier` are NOT redefined here. They already exist — the labels in
 * `MingmingUnit` (ticket 90) and the formatter in `elementMatchups` — and a second copy of a label
 * table is how a chip ends up reading "SCALING" on one surface and "CARDS PLAYED" on the other.
 */
/**
 * The firmware chip: which OS this body is running, and what it does on hover.
 *
 * Portalled, like every other tooltip on this screen, so the plaque's `overflow` and the stage's
 * stacking context can never clip it.
 */
export const FirmwareChip: React.FC<{ entity: IBattleEntity }> = ({ entity }) => {
    const [showOSTooltip, setShowOSTooltip] = React.useState(false);
    /*
     * `useAnchoredRect` rather than reading `ref.current.getBoundingClientRect()` inline — ticket
     * 55's hook, and the same one `StatusBadge` uses. The version this was lifted from measured the
     * ref DURING RENDER, which React 19 flags outright: the rect it returns is the one from before
     * the layout that is about to happen, so a tooltip opened on the frame a plaque moved would be
     * placed at the plaque's old position. It never showed on the HUD card because a sidebar card
     * does not move; on a stage where the active ally steps 60px, it would.
     */
    const { ref: osIconRef, rect } = useAnchoredRect<HTMLDivElement>(showOSTooltip);
    if (!entity.activeOS) return null;
    const behavior = getOSBehavior(entity.activeOS);
    return (
        <div
            ref={osIconRef}
            className="hud-os-icon-container"
            /*
             * TICKET 146g — the handle the OS tell flashes. §2g's family default is *"the owner's
             * plaque firmware chip flashes in the element colour"*, and every authored signature
             * gets the flash too: it is what ties whatever just played to the OS that did it.
             *
             * An attribute rather than React state on purpose. The alternative is a flag per unit
             * lifted to `BattleArena` and threaded back down through the stage, re-rendering six
             * plaques to flash one chip, for an effect that lasts 320ms and can affect nothing.
             */
            data-os-chip={entity.id}
            onMouseEnter={() => setShowOSTooltip(true)}
            onMouseLeave={() => setShowOSTooltip(false)}
        >
            {/* Ticket 34's closed glyph set already had `firmware` — an emoji here ignores `color`,
                            so the chip could not take its element tint. */}
                        <Icon name="firmware" className="hud-os-icon" />
            <span className="hud-os-version">{entity.activeOS.includes('_v2') ? 'V2' : 'V1'}</span>

            {showOSTooltip && rect !== null && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={rect !== null ? (() => {
                        const isRightSide = rect.left > window.innerWidth / 2;
                        return {
                            position: 'fixed',
                            left: isRightSide ? 'auto' : rect.right + 15,
                            right: isRightSide ? (window.innerWidth - rect.left) + 15 : 'auto',
                            top: rect.top,
                            transform: 'translateY(-30%)'
                        };
                    })() : {}}
                >
                    <div className="tooltip-header">
                        <span className="tooltip-os-name">{behavior?.name}</span>
                        <span className="tooltip-os-version">{entity.activeOS.includes('_v2') ? 'v2.0' : 'v1.0'}</span>
                    </div>
                    <div className="tooltip-divider" />
                    <div className="tooltip-body">
                        {behavior?.description}
                    </div>
                    <div className="tooltip-footer">TECHNICAL READOUT // SECTOR 0</div>
                </div>,
                document.body
            )}
        </div>
    );
    
};

/**
 * The daemon tags. A daemon is a passive the player bought and can lose track of, so it is named
 * rather than iconified — `title` carries the rule, as it did on the HUD card.
 */
export const DaemonTags: React.FC<{ entity: IBattleEntity; className?: string }> = ({ entity, className }) => {
    if (!entity.daemons || entity.daemons.length === 0) return null;
    return (
        <div className={className ?? 'hud-daemons-row'}>
            {entity.daemons.map((daemon, idx) => {
                if (!daemon.id) {
                    console.warn(`[UnitReadouts] Daemon at index ${idx} on ${entity.name} has an empty ID!`);
                }
                const data = GetProgramData(daemon.dataId);
                return (
                    <div
                        key={daemon.id || `daemon-${idx}`}
                        className="hud-daemon-tag"
                        title={data.description}
                    >
                        {/* The gear. `settings` is the closest shape in the closed set and it is the right
                            picture for a daemon — a passive that runs on its own. Named here rather than
                            borrowed silently, so a future `daemon` glyph knows where to land. */}
                        <Icon name="settings" className="hud-daemon-icon" />
                        <span className="hud-daemon-name">{data.name}</span>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * The hover preview: what this card would do to this unit, and why that number is that number.
 *
 * Two groups, deliberately separate rows. The first is what CHANGES — status deltas, which a
 * status-only card has instead of damage (before ticket 122 such a card previewed nothing at all).
 * The second is the ARITHMETIC behind the damage: STAB, hit count, lethality, Sharp, the scaling
 * multiplier and type effectiveness. Henry's "it did 5 damage + another 5 dmg" is the note the
 * hit-count chip answers.
 */
export const UnitPreview: React.FC<{ preview: DamagePreview | null; className?: string }> = ({ preview, className }) => {
    const previewDamage = preview?.damage ?? 0;
    if (!preview) return null;
    const rowClass = className ?? 'hud-preview-tags';
    return (
        <>
    {preview && preview.statusChanges.length > 0 && (
        <div className={rowClass}>
            {preview.statusChanges.map(({ status, delta }) => (
                <span
                    key={status}
                    className={`hud-preview-chip ${delta > 0 ? 'hud-preview-chip-super' : 'hud-preview-chip-weak'}`}
                >
                    {delta > 0 ? '+' : ''}{delta} {status.toUpperCase()}
                </span>
            ))}
        </div>
    )}
    {/* Elemental breakdown of the hover preview: STAB / type effectiveness / Sharp scaling */}
    {preview && previewDamage > 0 && (preview.stab || preview.effectiveness !== 1 || preview.sharpBonus > 0 || preview.scalingMultiplier !== 1 || preview.hitCount > 1 || preview.lethal) && (
        <div className={rowClass}>
            {preview.stab && (
                <span
                    className="hud-preview-chip"
                    style={{ color: getElementAccent(preview.element), borderColor: getElementAccent(preview.element) }}
                >
                    ×1.5 STAB
                </span>
            )}
            {/* TICKET 104: the multi-hit chip. The number above is the TOTAL the
                target loses - `blood_rite` reads 8, not "4" and then a surprise
                second 4. This says how that total arrives, which is the half of
                the information Henry was missing when he wrote "it did 5 damage +
                another 5 dmg". */}
            {preview.hitCount > 1 && (
                <span className="hud-preview-chip">
                    ×{preview.hitCount} HITS
                </span>
            )}
            {preview.lethal && (
                <span className="hud-preview-chip hud-preview-chip-lethal">
                    LETHAL
                </span>
            )}
            {preview.sharpBonus > 0 && (
                <span className="hud-preview-chip">
                    +{preview.sharpBonus} SHARP
                </span>
            )}
            {/* Ticket 90: the turn-history multiplier, named. A `stampede` reading
                "x4 CARDS PLAYED" explains its own number; before this the preview
                silently showed the card's printed power. */}
            {preview.scalingMultiplier !== 1 && (
                <span className="hud-preview-chip">
                    ×{formatMultiplier(preview.scalingMultiplier)} {SCALING_LABEL[preview.scalingKind ?? ''] ?? 'SCALING'}
                </span>
            )}
            {preview.effectiveness > 1 && (
                <span className="hud-preview-chip hud-preview-chip-super">
                    SUPER EFFECTIVE ×{formatMultiplier(preview.effectiveness)}
                </span>
            )}
            {preview.effectiveness < 1 && (
                <span className="hud-preview-chip hud-preview-chip-weak">
                    NOT VERY EFFECTIVE ×{formatMultiplier(preview.effectiveness)}
                </span>
            )}
        </div>
    )}
        </>
    );
};
