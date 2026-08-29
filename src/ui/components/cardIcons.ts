/**
 * The three icon/colour lookups the card face uses — ticket 55, step 3.
 *
 * They lived in `ProgramCard.tsx` and were imported from there by `TypeChart` and `RevealCard`,
 * which is what `react-refresh/only-export-components` reports: a file that exports both a component
 * and plain functions cannot be hot-reloaded as a component, so editing the card face during
 * development reloads the module instead of preserving state. Moving the non-components out is the
 * whole fix, and it costs nothing at runtime — these are three pure `Record` lookups with no imports
 * of their own.
 *
 * Kept together rather than split by element/category because they are the same kind of thing (a
 * display mapping for a data enum) and every caller that wants one tends to want another.
 */

/** Emoji for a card's element. `None` is the neutral tier (deck-archetypes ticket 16). */
export const getElementIcon = (el: string): string => {
    const map: Record<string, string> = {
        Fire: '🔥', Water: '💧', Nature: '🌿', Earth: '⛰️',
        Air: '💨', Ice: '❄️', Light: '✨', Dark: '🌑', None: '∅'
    };
    return map[el] ?? '◈';
};

/** Emoji for a card's category. */
export const getCategoryIcon = (cat: string): string => {
    const map: Record<string, string> = {
        Attack: '⚔️', Skill: '⚙️', Daemon: '👾',
        Heal: '💚', Status: '🧪', Special: '🌟'
    };
    return map[cat] ?? '◈';
};

/**
 * An element's colour, as the CSS custom property that defines it.
 *
 * Deliberately a `var()` rather than a hex: the eight `--fire`/`--water`/... properties in
 * `index.css` are the single seam ticket 38's colourblind-safe palette will swap, and a hex copied
 * out here would be the one place that did not follow.
 */
export const getElementColor = (el: string): string => {
    const map: Record<string, string> = {
        Fire: 'var(--fire)', Water: 'var(--water)', Nature: 'var(--nature)',
        Earth: 'var(--earth)', Air: 'var(--air)', Ice: 'var(--ice)',
        Light: 'var(--light)', Dark: 'var(--dark)'
    };
    return map[el] ?? '#888';
};
