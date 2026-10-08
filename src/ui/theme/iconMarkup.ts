/**
 * Test helper for ticket 205: which `InlineIcon`s a piece of markup draws, in order. Each one is an
 * `<svg data-icon="sword" data-variant="outline">`; the name is the Tabler name the surface's map
 * chose, so a test can say "the attack line draws the sword" without reading path data.
 */

export interface DrawnIcon {
    readonly name: string;
    readonly variant: string;
}

export function iconsIn(markup: string): DrawnIcon[] {
    return [...markup.matchAll(/data-icon="([^"]+)" data-variant="([^"]+)"/g)].map((m) => ({ name: m[1], variant: m[2] }));
}

/** Just the names, in order. */
export const iconNamesIn = (markup: string): string[] => iconsIn(markup).map((icon) => icon.name);
