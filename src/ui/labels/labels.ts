/**
 * THE WORDS ON SCREEN — ticket 183h (D1, ruled). One map from the name the code uses to the word the
 * player reads. Components that print one of these words ask here; none spells it out. The ids,
 * the save schemas, the registries, the test ids and the walker's output keep their old names:
 * this file is the only place the two vocabularies meet.
 *
 *   firmware / OS -> Instinct      daemon -> Aura      blueprint -> Trace    program -> Card
 *   reflash       -> Retrain       macro  -> Draught   assembly  -> Summon    driver  -> Totem
 *   workshop      -> Den           patch  -> Rune      scrap     -> Amber
 *
 * `Mingming` stays. An Instinct's own name is shown by `instinctName()`: `TIDAL_CRUSH_OS` reads
 * "Tidal Crush", `ABYSSAL_INK_SYS` reads "Abyssal Ink" (Henry's 183 review: no OS, no capitals).
 *
 * A separate `.ts` file with no React so the engine-facing tests and `plain()` can use it.
 */

export type LabelId =
    | 'firmware' | 'os' | 'reflash' | 'blueprint' | 'assembly' | 'workshop'
    | 'daemon' | 'macro' | 'patch' | 'driver' | 'scrap' | 'program';

/** The singular, capitalised: what a heading or a button prints. */
export const LABELS: Readonly<Record<LabelId, string>> = {
    firmware: 'Instinct',
    os: 'Instinct',
    reflash: 'Retrain',
    blueprint: 'Trace',
    assembly: 'Summon',
    workshop: 'Den',
    daemon: 'Aura',
    macro: 'Draught',
    patch: 'Rune',
    driver: 'Totem',
    scrap: 'Amber',
    program: 'Card',
};

/** Amber is a quantity, like gold: it has no plural. */
const MASS: ReadonlySet<LabelId> = new Set<LabelId>(['scrap']);

/** The word as printed in a sentence: `label('macro')` is `Draught`, `label('macro', { lower: true })` is `draught`. */
export function label(id: LabelId, options: { readonly plural?: boolean; readonly lower?: boolean } = {}): string {
    const base = LABELS[id];
    const word = options.plural === true && !MASS.has(id) ? `${base}s` : base;
    return options.lower === true ? word.toLowerCase() : word;
}

/**
 * Old word -> new word, by the shapes a data string uses. Each pattern is a whole word, so an id
 * with an underscore (`TIDAL_CRUSH_OS`, `harden_daemon`) is never touched.
 */
const FORMS: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bfirmwares?\b/gi, 'instinct'],
    [/\bOS\b/g, 'instinct'],
    // The status that makes a unit immune to Stunned and Asleep: its type is still `StableOS`; it reads Alert.
    [/\bStableOS\b/g, 'Alert'],
    [/\breflashed\b/gi, 'retrained'],
    [/\breflashing\b/gi, 'retraining'],
    [/\breflashes\b/gi, 'retrains'],
    [/\breflash\b/gi, 'retrain'],
    [/\bblueprints\b/gi, 'traces'],
    [/\bblueprint\b/gi, 'trace'],
    [/\bassembled\b/gi, 'summoned'],
    [/\bassembling\b/gi, 'summoning'],
    [/\bassembles\b/gi, 'summons'],
    [/\bassembl(?:y|e)\b/gi, 'summon'],
    [/\bworkshops\b/gi, 'dens'],
    [/\bworkshop\b/gi, 'den'],
    [/\bdaemons\b/gi, 'auras'],
    [/\bdaemon\b/gi, 'aura'],
    [/\bmacros\b/gi, 'draughts'],
    [/\bmacro\b/gi, 'draught'],
    [/\bpatches\b/gi, 'runes'],
    // "Patch one ally back up" (the Mend draught) is the verb, not the noun: it says what it does instead.
    [/\bpatch one ally back up\b/gi, 'heal one ally back up'],
    [/\bpatch\b/gi, 'rune'],
    [/\bdrivers\b/gi, 'totems'],
    [/\bdriver\b/gi, 'totem'],
    [/\bscraps?\b/gi, 'amber'],
    [/\bprograms\b/gi, 'cards'],
    [/\bprogram\b/gi, 'card'],
];

/** `TIDAL_CRUSH_OS`, `ECHO_CHAMBER_DAEMON+`: two or more capital words joined by underscores. Lower-case ids (`harden_daemon`) are not names. */
const OLD_STYLE_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\+?/g;

/** Carry the old word's capitals over to the new one: `Daemon` -> `Aura`, `DAEMON` -> `AURA`, `daemon` -> `aura`. */
function carryCase(from: string, to: string): string {
    // Two capitals (`OS`) is an abbreviation, not shouting: it takes the sentence's case.
    if (from.length > 2 && from === from.toUpperCase()) return to.toUpperCase();
    if (from.length > 2 && /[A-Z]/.test(from[0])) return to[0].toUpperCase() + to.slice(1);
    return to;
}

/**
 * A data string (a card's rules text, an event's sentence, a tip) with its old words replaced.
 * Used where the text comes from a registry that must not change; a component's own literal says
 * the new word directly instead.
 *
 * It only ever lengthens or shortens a word, so a caller that has character ranges into the string
 * (the lit clauses) must range over the result of `plain`, not the original.
 */
export function plain(text: string): string;
export function plain(text: string | undefined): string | undefined;
export function plain(text: string | undefined): string | undefined {
    if (text === undefined) return undefined;
    // An Instinct (or Rune) still named in capitals and underscores, as the hook text and the log say it.
    let result = text.replace(OLD_STYLE_NAME, (match) => instinctName(match));
    for (const [pattern, replacement] of FORMS) {
        result = result.replace(pattern, (match, offset: number, whole: string) => {
            const word = carryCase(match, replacement);
            // `OS is on ...` starts a sentence: the new word takes a capital there.
            const startsSentence = offset === 0 || /[.!?:]\s$/.test(whole.slice(Math.max(0, offset - 2), offset));
            return startsSentence ? word[0].toUpperCase() + word.slice(1) : word;
        });
    }
    return agreeArticles(result);
}

/** The new words that begin with a vowel sound, and the ones that do not: `a instinct` is `an instinct`. */
const NEW_WORDS = /\b(a|an)(\s+)(instincts?|alert|auras?|amber|summon\w*|traces?|totems?|draughts?|runes?|dens?|cards?|retrain\w*)\b/gi;

function agreeArticles(text: string): string {
    return text.replace(NEW_WORDS, (_match, article: string, gap: string, word: string) => {
        const vowel = /^[aeiou]/i.test(word);
        const next = vowel ? 'an' : 'a';
        return `${article[0] === 'A' ? next[0].toUpperCase() + next.slice(1) : next}${gap}${word}`;
    });
}

/** Every old word, for the sweep that fails a screen still printing one. */
export const OLD_WORDS = /\b(?:firmwares?|OS|StableOS|reflash(?:ed|ing|es)?|blueprints?|assembl(?:y|e|ed|es|ing)|workshops?|daemons?|macros?|patch(?:es)?|drivers?|scraps?|programs?)\b/gi;

/** The tail words of an old Instinct name that said what machine it ran on, not what it does. */
const MACHINE_WORDS: ReadonlySet<string> = new Set(['OS', 'SYS', 'KERNEL', 'FIRMWARE']);

/**
 * An Instinct's name as a player reads it. The registry says `TIDAL_CRUSH_OS`; the screen says
 * "Tidal Crush". The machine words (`OS`, `SYS`, `KERNEL`, `FIRMWARE`) go, `DAEMON` is an Aura, the
 * underscores become spaces and each word is Title Case. A name that is only a machine word keeps it.
 * Anything else (a `+` on an upgraded Rune, `GENERIC_CORE`, an id used as a fallback) is only re-cased.
 */
export function instinctName(raw: string): string {
    const words = raw.split(/[_\s]+/).filter((word) => word.length > 0);
    const kept = words.filter((word) => !MACHINE_WORDS.has(word.toUpperCase()));
    return (kept.length > 0 ? kept : words)
        .map((word) => (/^DAEMON\+?$/i.test(word) ? `Aura${word.endsWith('+') ? '+' : ''}` : word[0].toUpperCase() + word.slice(1).toLowerCase()))
        .join(' ');
}
