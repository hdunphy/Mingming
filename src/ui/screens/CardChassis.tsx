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

import type { ReactElement } from 'react';

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
