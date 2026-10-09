/**
 * The element colour lookup the card face uses - ticket 55, step 3.
 *
 * It lived in `ProgramCard.tsx` and was imported from there by `TypeChart` and `RevealCard`, which
 * is what `react-refresh/only-export-components` reports: a file that exports both a component and
 * plain functions cannot be hot-reloaded as a component, so editing the card face during
 * development reloads the module instead of preserving state. Moving the non-components out is the
 * whole fix, and it costs nothing at runtime.
 *
 * Ticket 200d: the two emoji lookups that used to sit beside it (an element's and a category's) are
 * gone. An element is drawn by `ElementMark` (a Tabler icon); nothing rendered the category.
 */

/**
 * An element's colour, as the CSS custom property that defines it.
 *
 * Deliberately a `var()` rather than a hex: the eight `--fire`/`--water`/... properties in
 * `index.css` are the single seam ticket 38's colourblind-safe palette will swap, and a hex copied
 * out here would be the one place that did not follow.
 */
export const getElementColor = (el: string): string => {
    const map: Record<string, string> = {
        Fire: 'var(--el-fire)', Water: 'var(--el-water)', Nature: 'var(--el-nature)',
        Earth: 'var(--el-none)', Air: 'var(--el-none)', Ice: 'var(--el-none)',
        Light: 'var(--el-none)', Dark: 'var(--el-none)'
    };
    return map[el] ?? 'var(--text-faint)';
};
