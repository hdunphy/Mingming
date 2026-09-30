# Ticket 175: Localization prep (string tables, then card-text templates)

**Type:** infrastructure. **Status:** OPEN. **Blocked on Henry's rulings L1–L5 below.** English only for now; no translations are ordered by this ticket.

**Henry (2026-09-30):**

> *"Prepare for localization, and I think we do this in two steps. First pull out all of the text into some sort of repository, whether that's Excel, JSON or something else. I've seen other people use CSVs with a column for each language and an ID, the English one. And then the second part is doing some kind of rich text, because we've done a lot of conditional work, but I'd rather do things like pull power directly from the card, or surround the conditional part of the card so it turns green."*

---

## Where the text is today

- **Card text:** `src/engine/data/programs.json` holds 367 cards, including the 98 `+` upgrades, each with a `name` and a free-text English `description`. Numbers are typed into the prose ("45 power") separately from the data (`"power": 45`), so the two can drift.
- **Conditional highlighting finds its words with English regexes.** `src/ui/utils/conditionalClauses.ts` splits the description into sentences and looks for words like "if", "while", "above" and status names to decide which clause turns green. Its own header says so: *"The description is authored prose, not generated from the actions, so this is a match and not a derivation."* This cannot work in another language.
- **Upgrade highlighting also diffs English text.** `CardChassis.tsx` / `litSegments.ts` compare the base and `+` descriptions word by word and paint the changed words (`rs-upn`).
- **Other content text:**
  - `events.json` (20 events: text, choice labels and details)
  - `tiers.json` and `modifiers.json`
  - `src/engine/data/lib/hooks.json` (84 descriptions: firmware and Drivers)
  - `mingmingRegistry.ts` (species and OS names and descriptions)
  - `macroRegistry.ts`, `patchRegistry.ts`, `statusGlossary.ts`, `tips.ts`, and the gym, boss and biome names in `gyms.ts` and `bosses.ts`
- **Sentences built in code:**
  - `cardConditionals.describeConditional`
  - `drawFormula.describeDraw` / `drawTooltipLines`
  - `osGrammar.ts`
  - `src/ui/events/describeOutcome.ts`
  - the damage and status preview readouts
- **UI text:** about 250 literal text nodes across the 62 non-test `.tsx` files in `src/ui`, plus template strings (`` `${n} fights · ${scrap} scrap` ``). There is no i18n library in `package.json`.

---

## Decisions for Henry

**L1. Where the strings live: CSV files, one per area, a column per language.** *(recommended, and what you described)*

`locales/cards.csv`, `locales/content.csv` (events, species, OS, Drivers, macros, patches, statuses, tips, tiers, modifiers, places) and `locales/ui.csv`. Columns: `key, context, en`, then one column per language later (`fr`, `de`, …). `context` is a short note for translators ("button, max 12 characters").

CSVs open in Excel or Google Sheets and diff line by line in git. The game reads them directly at startup (Vite `?raw` import plus a small parser), so no generated files sit in the repo to go stale.

**L2. Where English is written.** *(recommended: the CSV is the single source)*

Every player-facing English string moves into the CSVs, and code and data keep only ids and keys. One place to edit, and nothing to keep in sync.

The cost: debug and balance tools that print card text (`deckReport` and others under `src/debug/balance`) must read through the same lookup. The alternative, English staying in `programs.json` and friends with the CSV as a mirror, means an extraction script and a staleness test forever.

**L3. No i18n library.** *(recommended)*

A small in-house `t(key, params)` (lookup, fall back to English, fill `{name}` placeholders, pick plural forms with the browser's built-in `Intl.PluralRules`) is about 100 lines across a few small modules. i18next / react-i18next is the alternative if you'd rather have a standard.

**L4. The card-text template syntax.** *(recommended as below)*

- **`{a0.power}`** inserts a value from the card's own actions: `a0` is the first entry in the card's `actions` array (0-based), and the field is any number on that action (`power`, `stacks`, `count`, `amount`, …). The number comes from the data, so tuning a card never needs a text edit.
- **`[if a1]…[/if]`** marks the words that turn green when action 1's conditionals are true for this caster and target. This replaces the regex matching.

Example, Pile On: `{a0.power} power. [if a1]If the target is Dazed, hit again.[/if]`

Square-bracket tags and curly tokens survive spreadsheets and translators well, and don't collide with React or HTML.

**L5. Live numbers in the hand: later, not in this ticket.** *(recommended)*

With templates, the hand could show a card's number after Strength or Weakened (green if higher, red if lower, as Slay the Spire does). That's a gameplay-readability change, not localization. This ticket leaves room for it (the renderer takes an optional "live value" per token) but doesn't turn it on.

---

## How to work this ticket

1. **Read the whole row first.** Paths were checked against `133e0db` (2026-09-30). Search for the quoted code; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **English must not change.** Every row is a refactor: the game reads identically before and after. The tests below prove it string by string.
4. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
5. **Gate:** `npm run gate` green before each commit.
6. **Commits:** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), **no `Co-Authored-By` trailers**, last line `HANDOFF: <one sentence>`. **Do not push.**
7. **Line endings:** keep each file's. CRLF under `docs/wayfinder`; new files under `src/` and `locales/` are LF.
8. **Small single-purpose modules** (Henry's standing preference): the CSV parser, the string table, `t()`, plural rules and the pseudo-locale are separate files.
9. **`src/debug` is out of scope:** debug panels stay English and untranslated.
10. **Report** in plain English at the end, including every card whose text and data disagreed (175g).

| Row | Part | What |
|---|---|---|
| 175a | 1 | The i18n core: CSV parser, string table, `t()`, plurals, the language setting |
| 175b | 1 | Content text into `locales/content.csv` |
| 175c | 1 | Card names and descriptions into `locales/cards.csv` |
| 175d | 1 | UI text into `locales/ui.csv`, plus a test that fails on new hard-coded text |
| 175e | 1 | Sentences built in code, through `t()` with parameters |
| 175f | 1 | The pseudo-locale, for finding misses and text overflow |
| 175g | 2 | The card template renderer, and every card description converted to a template |
| 175h | 2 | Green conditionals and upgrade highlights driven by the templates; the regex matching deleted |

---

## 175a: The i18n core

All new, under `src/i18n/`:

1. **`parseCsv.ts`:** RFC 4180 CSV (quoted fields, `""` escapes, commas and newlines inside quotes). Returns rows of strings. No dependency.
2. **`stringTable.ts`:**
   - `loadTable(csvText): Map<key, Record<lang, string>>`
   - throws on a duplicate key or a row with no `en`
   - `lookup(table, key, lang)` falls back to `en` when the language cell is empty
   - an unknown key returns `⟦key⟧` and records it in a `missingKeys` set, so a miss is visible on screen and in tests
3. **`plural.ts`:** `pluralKey(key, count, lang)` tries `key_one` / `key_other` (and the other `Intl.PluralRules` categories) and falls back to `key`.
4. **`t.ts`:** `t(key, params?)`. It fills `{name}` placeholders from `params`, and uses `params.count` for plurals. It reads the current language from `locale.ts`.
5. **`locale.ts`:**
   - holds the current language (default `en`)
   - one `setLanguage(lang)`
   - a React hook `useLanguage()` so screens re-render on change
6. **`strings.ts`:** imports the three CSVs with Vite's `?raw` and builds one table. It works in vitest too. Missing CSV files at this stage are empty tables.
7. **Settings:** `src/ui/settings/settings.ts` gets `language: 'en'`, persisted like the other settings. No visible picker yet; 175f adds a debug toggle.
8. **Tests:**
   - the parser handles quotes, embedded commas, newlines and `""`
   - duplicate keys throw
   - fallback to `en` works
   - unknown keys show `⟦key⟧` and are recorded
   - `{name}` fills in
   - `_one` / `_other` pick correctly for English

## 175b: Content text → `locales/content.csv`

1. **Key scheme** (write it at the top of the CSV as a comment row `#` that the parser skips; add that rule to the parser):
   - `event.<id>.text` · `event.<id>.choice.<choiceId>.label` · `event.<id>.choice.<choiceId>.detail`
   - `species.<id>.name` · `os.<osId>.name` · `os.<osId>.desc`
   - `hook.<id>.name` · `hook.<id>.desc`
   - `macro.<id>.name` · `macro.<id>.desc` · `patch.<id>.name` · `patch.<id>.desc`
   - `status.<id>.name` · `status.<id>.desc`
   - `tip.<id>` · `tier.<n>.name` · `tier.<n>.desc` · `modifier.<id>.name` · `modifier.<id>.desc`
   - `gym.<id>.name` · `boss.<id>.*` · `biome.<id>.name`
2. **One-time move script,** `scripts/extract-content-strings.mjs` (kept, so the move can be re-run from a clean tree): it writes the CSV from the current data files. Then **remove** the English fields from the data (L2). Each reader switches to a small accessor in `src/i18n/content/`: `eventText(id)`, `speciesName(id)`, `osDesc(osId)`, and so on. One file per area; no giant switch.
3. **Test:** for every id in every registry, the accessor returns exactly the English string the data file held before the move. Build the expected strings from the parent commit's files, saved as a fixture JSON in the test folder.

## 175c: Card names and descriptions → `locales/cards.csv`

1. Keys `card.<id>.name` and `card.<id>.desc`, including every `+` id (`card.scald+.desc`).
2. Same one-time script approach (`scripts/extract-card-strings.mjs`); remove `name` and `description` from `programs.json` (L2). **All** readers go through `cardName(id)` / `cardText(id)` in `src/i18n/content/cards.ts`.
   - Find the readers with `grep -rn "\.description\|\.name" src --include=*.ts --include=*.tsx`, then keep only the ones reading `ProgramData`.
   - This includes the balance tools under `src/debug/balance` that print card text (`deckReport.ts` and others).
3. **Leave the collection browser alone.** `docs/wayfinder/deck-archetypes/collection-v2/` keeps its own design copy of the card text (`collection.py`, `upgrades.json`) and never reads `programs.json`. Do not touch it.
4. **Test:** as in 175b, all 367 cards return their old name and description exactly.

## 175d: UI text → `locales/ui.csv`

1. Keys `ui.<screen>.<name>`, e.g. `ui.runStart.chooseGym`, `ui.battle.endTurn`. Template strings become one key with placeholders: `` `${n} fights · ${scrap} scrap` `` → `ui.run.fightsScrap` = `{fights} fights · {scrap} scrap`, called as `t('ui.run.fightsScrap', { fights, scrap })`.
2. **Every non-test `.tsx` under `src/ui`,** one screen or component per commit if that keeps commits reviewable. Card, species and other content names come from 175b/175c accessors, not from `ui.csv`.
3. **Guard test,** `src/i18n/noHardcodedText.test.ts`: scan every non-test `.tsx` under `src/ui` for JSX text nodes containing a letter (regex over the source is enough: text between `>` and `<` that is not whitespace, a `{…}` expression or punctuation only) and for string literals passed to `title=`, `placeholder=` and `aria-label=`. It fails on any hit not listed in `src/i18n/allowedLiterals.json`. Keep that allowlist small: symbols like `×`, `→`, `/`.
4. **Test:** the existing screen and component tests pass unchanged. They assert English text, which must not change.

## 175e: Sentences built in code

Move every English sentence assembled in code into keys with parameters:

- `cardConditionals.describeConditional`
- `drawFormula.describeDraw` and `drawTooltipLines`
- `osGrammar.ts`
- `src/ui/events/describeOutcome.ts`
- the preview readouts in `src/ui/utils/`: `damagePreview.ts`, `handPreview.ts`, `macroPreview.ts`

Where English grammar is built from parts ("draw" + "s"), use a plural key instead of string arithmetic. Existing tests for these files must pass unchanged.

## 175f: The pseudo-locale

1. **`src/i18n/pseudo.ts`:** a generated `pseudo` language, not a CSV column. Every English string is transformed:
   - accented look-alikes (`a→á`, `e→é`, …)
   - padded about 40% longer (roughly what German needs)
   - wrapped in `[!! … !!]`
   - `{placeholders}` and `[if …]` tags left untouched
2. **A toggle in the debug panel** (`src/debug/panels/`) switches the language between `en` and `pseudo`.
3. **What it's for (Henry, manual):** play a run in `pseudo`. Any plain English left on screen is a string 175b–e missed, and any clipped or overflowing text marks a layout that will break in German or French. Note them in the report; do not fix layouts in this ticket.
4. **Test:** the transform preserves placeholders and tags, and is longer than its input.

---

## 175g: Card templates (part 2)

1. **`src/i18n/cards/parseTemplate.ts`:** parses a description into tokens:
   - text
   - `{aN.field}` value tokens
   - `[if aN]` / `[/if]` spans; nesting is not allowed and throws
2. **`src/i18n/cards/renderCardText.ts`:** `renderCardText(template, program, options?)` returns segments `{ text, valueOf?: {action, field}, conditionalAction?: number }`.
   - `options.liveValues?` is the hook L5 leaves for later: when given, a token shows the live number instead of the printed one. Unused in this ticket.
   - Plain-string rendering, `cardPlainText(id)`, joins the segments.
3. **Convert every card's English `desc` in `locales/cards.csv` to a template:**
   - every number that comes from an action becomes a token
   - every conditional clause gets `[if aN]`, where `aN` is the action carrying that conditional
   - write the conversion as a script, `scripts/templatize-cards.mjs`, that proposes templates by matching each action's numbers into the text, then review its output by hand

   Numbers that are not in the data (flavour, "half HP") stay as text.
4. **The safety test, the heart of this row:** for all 367 cards, `cardPlainText(id)` equals the pre-template English description exactly.
   - **If a card's printed number does not match its data** (the text says 40 and the action says 45), **do not pick one.** List it in the report and leave that number as plain text, so English is unchanged. Henry rules each one. These are real bugs today.
5. **Test:** every action that has `conditionals` in `programs.json` sits inside exactly one `[if]` span naming it. This replaces the registry walk in `conditionalClauses.test.ts`.

## 175h: Highlighting from templates

1. **Green conditionals:** `HandCardFace.tsx` passes `lit` ranges into `CardFace` (in `src/ui/screens/CardChassis.tsx`, painted by `paintSegments` in `litSegments.ts`) today, from `litClauses` in `conditionalClauses.ts`. Replace that with the segments from `renderCardText`. A segment whose `conditionalAction` reads true (`readCardConditionals` in `cardConditionals.ts` already computes this) is painted `rs-lit`.
2. **Upgrade highlights:** render the base card's and the `+` card's templates. A value token whose number differs is painted `rs-upn`. Keep the current word-diff as the fallback for text that differs outside tokens: when a `+` card adds or removes a whole clause, highlight that clause.
3. **Delete** the regex matching in `conditionalClauses.ts` (`splitClauses`, `clauseForEachConditional`, `litClauses` and the word lists). Keep any exported type still imported elsewhere, or move it.
4. **Tests:**
   - the existing hand tests that expect "If the target is Dazed, draw 1" to turn green still pass
   - an upgrade whose only change is power 45 → 55 highlights exactly "55"
   - in `pseudo`, the same conditional still turns green; that's the proof the new highlighting doesn't depend on English

---

## Done when

- All player-facing text outside `src/debug` comes from `locales/*.csv`, and a test fails on new hard-coded UI text.
- Card numbers render from card data, and green conditionals and upgrade highlights work from template markup in any language, shown in `pseudo`.
- English reads exactly as before, apart from the card text/data mismatches Henry rules on.
- Henry has a pseudo-locale run's list of misses and overflow to act on.
