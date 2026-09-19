/**
 * THE CARD CHASSIS — ticket 34 part two, built to ticket 66's ruled reference
 * (`research/66-frames-proto/frames_chassis_final.html`).
 *
 * That file is a *spec*, not a mood board, and it says four things in its own subtitle:
 *
 * > Ruled: Chassis direction · energy PIPS top-left (cost as capacity) · TYPE ICON top-right
 * > (▲ attack · ✦ skill · ◆ daemon · ● macro) replaces the text banner · no STAB text · no payoff
 * > glow (payoff = tag in editor contexts only) · descriptions present at BOTH scales.
 *
 * Two of those four are what this file is: the pips and the mark. (The STAB text was already gone,
 * and descriptions already print at both scales — `runShell.cardFace`'s header is the argument for
 * why.)
 *
 * # WHY PIPS INSTEAD OF A NUMBER, AND WHY "AS CAPACITY"
 *
 * The corner used to hold a big blue gem with a numeral in it. A numeral is a *price* — you read it,
 * then you do arithmetic against your energy. Pips are a *quantity*: three pips against two energy
 * is a comparison you make by looking, without counting either side. That is the whole of "cost as
 * capacity", and it is worth more in this game than in most because a turn is 2 energy, so almost
 * every decision is "can I afford this AND that".
 *
 * **A 0-cost card shows ONE UNFILLED pip, not zero pips**, which is the reference's own convention
 * (`Water Slap` and `Healing Mist` both draw a single `off` pip). An empty rack says "free" much
 * better than an empty corner does — an empty corner just looks like something failed to render.
 *
 * # WHY A GLYPH FOR THE TYPE AND NOT AN ICON FROM `theme/Icon`
 *
 * Ticket 34 part one replaced the game's emoji with drawn SVG, and the reason was font coverage and
 * colour: an emoji is picked by the player's system and ignores `color`. These four are neither —
 * `▲ ✦ ◆ ●` are plain geometric marks present in every UI font, they take `color` and `text-shadow`
 * like any character, and the reference specifies them AS characters with a glow that only works on
 * text. They are in the same class as the `✓` in a button and the `★` in a progress row, which
 * `Icon.test.tsx`'s sweep already allows by name.
 */

import type { ReactElement, ReactNode } from 'react';

import type { Banner } from './runShell';

/**
 * The type mark, top-right. Replaces the coloured text banner the tiles used to carry.
 *
 * The banner said `ATTACK` in a red pill — eight characters and a background to say one bit of
 * information, on a tile 142px wide at hand scale. The mark says it in one character and leaves the
 * width for the card's name.
 */
const TYPE_MARK: Readonly<Record<Banner, string>> = {
    ATTACK: '▲',
    SKILL: '✦',
    DAEMON: '◆',
    MACRO: '●',
};

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

export function ElementMark({ element, compact = false }: {
    readonly element: string;
    /** True on a 27px row: the three-letter code rather than the word. */
    readonly compact?: boolean;
}): ReactElement {
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

export function TypeMark({ banner }: { readonly banner: Banner }): ReactElement {
    // `title` rather than visually-hidden text: the mark is a shorthand for a word the card's own
    // description already implies, so it earns a tooltip and not a line of layout.
    return <span className={`rs-typ ${banner}`} title={banner}>{TYPE_MARK[banner]}</span>;
}

/**
 * The energy rack, top-left. `cost` filled pips, or one unfilled pip at zero.
 *
 * X-cost cards arrive here already resolved through `numericBaseCost` (the shared 3-energy static
 * budget, ticket 22), so an X card racks as the expensive card it plays as rather than as a special
 * case this component would have to know about.
 */
export function EnergyPips({ cost }: { readonly cost: number }): ReactElement {
    const slots = Math.max(cost, 1);
    return (
        <span className="rs-pips" aria-label={`${cost} energy`}>
            {Array.from({ length: slots }, (_, i) => (
                // `undefined` rather than `''` for a filled pip: React renders an empty string as
                // `class=""`, and a filled pip is the default state — it should carry no attribute.
                <i key={i} className={i < cost ? undefined : 'off'} />
            ))}
        </span>
    );
}

/**
 * THE WHOLE TILE — the face the shop and the collection draw, as one component.
 *
 * Henry, 2026-09-11: *"on hover of the Edit Loadout screen you should see what the active deck
 * cards look like. I need to see the full card that I would see from the shop or card collection
 * when I hover."*
 *
 * The active deck is a list of 27px rows — cost, element code, name — which is the right shape for
 * a list you are editing and the wrong shape for deciding whether to cut a card. The hover answer
 * has to be the SAME card the collection shows, not a second rendering that could drift from it,
 * so the tile stops being markup inlined at each call site and becomes this.
 *
 * Pure and prop-driven: the grid tile is a `<button>` that adds a card, the hover preview is a
 * floating `<div>`, and neither behaviour belongs in the face. The caller supplies the element.
 */
/**
 * THE ONE CARD FACE — ticket 155e.
 *
 * Henry, 2026-09-19: the hand cards *"don't look like the shop cards"*. They were supposed to since
 * ticket 145d, and the reason they did not is that `HandCardFace` adopted the chassis' CLASSES and
 * then added three rows of its own — a target chip, a keyword strip and a readout — to a tile whose
 * description is the only flexing row. Three extra rows is three rows the description gives up, and
 * in a 176px card it clipped mid-sentence.
 *
 * So there is now one face, and the fight's extras go where they cost nothing:
 *
 *   - the TARGET rides on the name row as a small tag, not a row of its own;
 *   - the READOUT rides inside the existing tag line beside the element word
 *     (`FIRE · 96 DMG vs SKOLL`), which is the row the shop already spends on metadata;
 *   - the keyword chips carry their stacks, so the separate status summary is gone.
 *
 * Every caller — shop, loadout editor, hand, reveal lane — renders this. That is the property the
 * ticket is really asking for: not "make them look similar" but "make them the same component", so
 * the next divergence has nowhere to live.
 *
 * NO STAB TEXT. Ticket 66 ruled it out and `HandCardFace` had grown a `×1.5` pip anyway; the `--el`
 * glow is the cue, and 155e says so in as many words.
 */
export function CardFace({ face, count, tags, target, readout, keywords, extras }: {
    readonly face: {
        readonly name: string;
        readonly description: string;
        readonly element: string;
        readonly cost: number;
        readonly banner: Banner;
    };
    readonly count?: number;
    readonly tags?: string;
    /** Where this card may land. A tag on the name row in every mode — it is a shopping question too. */
    readonly target?: string;
    /** The fight's preview, rendered inside the tag line after the element word. */
    readonly readout?: ReactNode;
    /** Keyword chips, which carry their own stack counts. */
    readonly keywords?: ReactNode;
    /** Cost-was, cannot-pay, replay — things that hang off the pips rather than taking a row. */
    readonly extras?: ReactNode;
}): ReactElement {
    return (
        <>
            <EnergyPips cost={face.cost} />
            {extras}
            <TypeMark banner={face.banner} />
            <span className="rs-art" />
            <span className="rs-nmrow">
                <span className="rs-cnm">{face.name}</span>
                {target && <span className="rs-tgt">{target}</span>}
            </span>
            <span className="rs-desc">{face.description}</span>
            {keywords}
            <span className="rs-tags">
                <ElementMark element={face.element} />
                {readout}
                {tags && <span className="rs-tg">{tags}</span>}
            </span>
            {count !== undefined && count > 1 && <span className="rs-nbadge">×{count}</span>}
            <span className="rs-elbar" />
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
        readonly banner: Banner;
    };
    /** Copies held. Prints the ×N badge above 1, exactly as the collection grid does. */
    readonly count?: number;
    /** `pick`, `benched` — the collection's own word for where this card sits. */
    readonly tags?: string;
}): ReactElement {
    return <CardFace face={face} count={count} tags={tags} />;
}
