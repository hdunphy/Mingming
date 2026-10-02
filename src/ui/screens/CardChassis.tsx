/**
 * THE CARD CHASSIS — ticket 34 part two, redrawn in the Slant kit by ticket 183c.
 *
 * One face for every full card in the game: the hand, the hover card, the stall tile, the reward
 * pick, the upgrade preview, the pile viewers and the codex (183 D2). The compact 27px deck row is
 * not a full card and keeps its own shape; its element code and colours are the kit's.
 *
 * # THE FACE, TOP TO BOTTOM (ticket 183 "The pieces")
 *
 *   header      element mark · name · energy hexagon, on a band in the element's colour
 *   art slot    the hatch placeholder until the art pass (the one gradient the kit allows)
 *   target tag  where the card may land, as an icon on a small navy plate
 *   rules text  with the clauses that are true right now lit in the selection yellow
 *   foot        the readout strip when the fight has a figure for it, else a 5px element bar
 *
 * There is no type mark (D3, ruled) and no energy pips: the energy hexagon is the one cost symbol
 * in the game, and the header's colour is the element's. The old chassis' history is kept where it
 * still explains a decision below.
 *
 * # STAB AND SELECTION ARE PAINTED BY THE CALLER'S ATTRIBUTES
 *
 * The face carries no state. The hand sets `data-stab` and `data-selected` on the element that
 * holds the face, and `runShell.css` turns them into the element-coloured frame and the yellow
 * ring. That keeps the face a pure function of its props and gives every other surface the same
 * two states for free.
 *
 * # WHY AN ICON FOR THE ELEMENT AND NOT A WORD (still true)
 *
 * Ticket 34's playtest note: four of the old nine hues were blues, so colour alone could not say
 * Water from Air. The mark says it by symbol (drop, flame, leaf, dot) and by colour, and its hover
 * and screen-reader text are the word.
 */

import type { ReactElement, ReactNode } from 'react';

import { Icon } from '../theme/Icon';
import './card/card.css';
import type { IconName } from '../theme/icons';
import type { TextRange } from '../utils/conditionalClauses';
import { CardHeader, CostExtras } from './card/CardHeader';
import { CardRules } from './card/CardRules';
import { TargetTag } from './card/TargetTag';

/**
 * THE ELEMENT, IN WORDS — the 2026-08-30 playtest.
 *
 * Henry: *"The new cards are not clear which element they are."* They were not, and colour was the
 * whole reason. The chassis carried element as `--el` alone — a border, a pip fill and the art
 * gradient — and `runShell.ELEMENT_COLOR` holds Water `#3d9be0`, Air `#8fc7f5`, Ice `#7fd6ff` and
 * None `#9aa3ad`: four blues that are one glance apart on a 152px tile. A player picking a card in
 * a shop is picking a TYPE MATCHUP, so the one fact the tile refused to state was the fact the
 * decision runs on.
 *
 * **A word, not an icon.** `ProgramCard` (the fight) uses `cardIcons.getElementIcon`'s emoji, which
 * is why the fight has never had this problem — but this file's own header rules emoji out of the
 * chassis (they ignore `color`), and the eight elements have no geometry in `theme/icons`. A word
 * needs no lookup, survives ticket 38's colourblind palette swap intact, and cannot be confused
 * with the four type marks above.
 *
 * **It costs no layout.** The tile prints it inside `.rs-tags`, a metadata line that already exists
 * and is usually empty, and the 27px row prints the three-letter code beside the cost gem. Neither
 * takes a pixel from `.rs-desc` — ticket 63 put those descriptions there because Henry could not
 * compare cards without them, and this fix may not quietly undo that one.
 */
const ELEMENT_WORD: Readonly<Record<string, string>> = {
    Fire: 'FIRE', Water: 'WATER', Nature: 'NATURE', Earth: 'EARTH', Air: 'AIR',
    Ice: 'ICE', Light: 'LIGHT', Dark: 'DARK', None: 'NEUTRAL',
};

/** The row form. Three letters, because a 27px row is a scan and not a read. */
const ELEMENT_CODE: Readonly<Record<string, string>> = {
    Fire: 'FIR', Water: 'WTR', Nature: 'NAT', Earth: 'ERT', Air: 'AIR',
    Ice: 'ICE', Light: 'LGT', Dark: 'DRK', None: 'NEU',
};

/** TICKET 182a: the four elements with an icon today; the rest keep their word until they get one. */
const ELEMENT_ICON: Readonly<Record<string, IconName | undefined>> = {
    Fire: 'el-fire', Water: 'el-water', Nature: 'el-nature', None: 'el-none',
};

export function ElementMark({ element, compact = false }: {
    readonly element: string;
    /** True on a 27px row: the three-letter code rather than the word. */
    readonly compact?: boolean;
}): ReactElement {
    const icon = compact ? undefined : ELEMENT_ICON[element];
    if (icon) {
        // TICKET 182a (R4): the full-size mark is an ICON in the element colour, with the word as
        // its hover and for screen readers. The compact row code below is untouched.
        return (
            <span className="rs-elw rs-elw-icon" title={`${element} element`} aria-label={ELEMENT_WORD[element]}>
                <Icon name={icon} size={13} />
            </span>
        );
    }
    const table = compact ? ELEMENT_CODE : ELEMENT_WORD;
    // An unknown element prints itself rather than an empty span: a card whose element is not in
    // the palette is a data bug, and it should be visible on the card that has it.
    const text = table[element] ?? element.toUpperCase();
    return (
        <span className={compact ? 'rs-elc' : 'rs-elw'} title={`${element} element`}>
            {text}
        </span>
    );
}

/**
 * THE ONE CARD FACE — ticket 155e, redrawn by 183c.
 *
 * Henry, 2026-09-19: the hand cards *"don't look like the shop cards"*. The fix then, and still the
 * rule, is that every caller renders THIS: not "make them look similar" but "make them the same
 * component", so the next divergence has nowhere to live. The shop, the editor, the hand, the
 * reveal lane, the pile viewers, the upgrade bench and the codex all pass a face to it.
 *
 * It renders into whatever element the caller provides (a `<button>` in a shop, a `<div>` in the
 * fan) and paints in two layers: the frame behind (`::before` of the caller's `.rs-card`) and
 * `.rs-body`, the clipped inner card. Anything that hangs OFF the card — the ×N badge, a price
 * plate — is a sibling of the body, not inside it, so the slant never clips it.
 */
export function CardFace({ face, count, tags, target, readout, keywords, extras, lit, rules }: {
    readonly face: {
        readonly name: string;
        readonly description: string;
        readonly element: string;
        /** Absent on a body that is not a card (a blueprint). */
        readonly cost?: number;
        /**
         * TICKET 163b — when the face knows which card it is, an UPGRADED card's moved numbers
         * are picked out (§4). Optional because several callers build a face by hand from a stack
         * or an offer and have nothing to look up; those render plain text.
         */
        readonly dataId?: string;
    };
    readonly count?: number;
    readonly tags?: string;
    /** Where this card may land. A tag under the art in every mode — it is a shopping question too. */
    readonly target?: string;
    /** The fight's readout (`ReadoutStrip`). Absent, the foot is the 5px element bar. */
    readonly readout?: ReactNode;
    /** Keyword chips, which carry their own stack counts. */
    readonly keywords?: ReactNode;
    /** Cost-was, cannot-pay, replay — things that hang off the energy hexagon. */
    readonly extras?: ReactNode;
    /** Ranges of the description to paint as TRUE RIGHT NOW — the fight's conditional read. */
    readonly lit?: ReadonlyArray<TextRange>;
    /**
     * TICKET 183f — what stands where the rules text goes, when the face is not a card: a starter
     * shows the monster's three stats there (172's ruling). Absent, the description is printed.
     */
    readonly rules?: ReactNode;
}): ReactElement {
    return (
        <>
            <span className="rs-body">
                <CardHeader name={face.name} element={face.element} cost={face.cost} />
                <span className="rs-art"><TargetTag target={target} /></span>
                {rules ?? <CardRules description={face.description} dataId={face.dataId} lit={lit} />}
                {keywords}
                {tags && (
                    <span className="rs-tags">
                        <span className="rs-tg">{tags}</span>
                    </span>
                )}
                {readout ?? <span className="rs-elbar" />}
            </span>
            <CostExtras>{extras}</CostExtras>
            {count !== undefined && count > 1 && <span className="rs-nbadge">×{count}</span>}
        </>
    );
}

/**
 * The collection's face. A thin call to `CardFace` — kept as its own name because twenty-odd
 * callers spell it, and renaming them would bury 155e's actual change in a rename diff.
 */
export function CardTileFace({ face, count, tags }: {
    readonly face: {
        readonly name: string;
        readonly description: string;
        readonly element: string;
        readonly cost: number;
        readonly dataId?: string;
    };
    /** Copies held. Prints the ×N badge above 1, exactly as the collection grid does. */
    readonly count?: number;
    /** `pick`, `benched` — the collection's own word for where this card sits. */
    readonly tags?: string;
}): ReactElement {
    return <CardFace face={face} count={count} tags={tags} />;
}
