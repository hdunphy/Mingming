/**
 * TICKET 183h — what a screen shows, as the sweep reads it: the text a player sees plus the text
 * they get on hover and from a screen reader (`title`, `aria-label`, `alt`, `placeholder`). The
 * old words fail wherever they are printed, so a hover that still says "firmware" is as wrong as a
 * heading that does.
 */
import { OLD_WORDS } from './labels';

const ATTRS = /\b(?:title|aria-label|alt|placeholder)="([^"]*)"/g;

function decode(text: string): string {
    return text
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
}

/** Every string a rendered screen prints, one per entry. */
export function printedStrings(markup: string): string[] {
    const attrs = [...markup.matchAll(ATTRS)].map((m) => decode(m[1]));
    const body = markup
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<script[\s\S]*?<\/script>/g, ' ')
        .replace(/<[^>]*>/g, '\n');
    const text = decode(body).split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    return [...attrs, ...text];
}

/** The old words found in a screen, each with the line it sits in. */
export function oldWordsIn(markup: string): string[] {
    const found: string[] = [];
    for (const line of printedStrings(markup)) {
        const hits = line.match(OLD_WORDS);
        if (hits) found.push(`${[...new Set(hits.map((h) => h.toLowerCase()))].join(',')}: ${line.slice(0, 110)}`);
    }
    return [...new Set(found)];
}

/** A name still printed in capitals with underscores (`TIDAL_CRUSH_OS`, `ACTIVE_KERNEL`): a screen should say "Tidal Crush". */
const CAPS_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

export function capsNamesIn(markup: string): string[] {
    const found = printedStrings(markup).filter((line) => CAPS_NAME.test(line)).map((line) => line.slice(0, 110));
    return [...new Set(found)];
}
