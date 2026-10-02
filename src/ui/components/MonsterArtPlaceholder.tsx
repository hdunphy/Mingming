import type React from 'react';

interface MonsterArtPlaceholderProps {
    /** Positioning/size hook for the place it is drawn: `stage-art-wip` or `hud-art-wip`. */
    className?: string;
    /** The caller's own state styling (accent, rim light, dead dimming) rides here unchanged. */
    style?: React.CSSProperties;
}

/**
 * The "art is not ready" block: a blob that says ART PENDING, in the unit's own accent colour.
 *
 * It draws nothing but the block. Whether to draw it instead of a sprite is
 * `MONSTER_ART_ENABLED`'s call, and what the surrounding frame does (animation, rim light, dead
 * dimming) stays with the caller, so a placeholder unit still reads as active or dead.
 */
const MonsterArtPlaceholder: React.FC<MonsterArtPlaceholderProps> = ({ className = '', style }) => (
    <div className={`wip-art-block ${className}`.trim()} style={style} data-testid="monster-art-wip" aria-label="Artwork in progress">
        <span className="wip-art-tag">ART</span>
        <span className="wip-art-sub">PENDING</span>
    </div>
);

export default MonsterArtPlaceholder;
