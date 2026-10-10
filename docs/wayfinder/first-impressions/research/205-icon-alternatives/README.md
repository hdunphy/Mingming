# 205 follow-up: icon alternatives (206 items B7 and B10)

A picture sheet so Henry can point at a choice. It changes no game file.

- `sheet.html`: five pages, 1280 x 800 each. Open `sheet.html?page=N` to see one page. The page loads the game's Barlow fonts from `public/fonts/`, so open it from inside the repo.
- `sheet-1.png` to `sheet-5.png`: the pages at 1x, so the small sizes show the pixels they really get. `sheet-N@2x.png`: the same pages at 2x, for a closer look at the shapes.
- `build-sheet.mjs`: writes `sheet.html` from the installed `@tabler/icons` (3.49.0). From the repo root, run `node docs/wayfinder/first-impressions/research/205-icon-alternatives/build-sheet.mjs .`. The PNGs come from headless Chrome: `chrome --headless=new --hide-scrollbars --window-size=1280,800 --force-device-scale-factor=1` (or `=2`) `--screenshot=sheet-N.png "file:///.../sheet.html?page=N"`.

Every icon is Tabler's own node data (MIT, Paweł Kuna), drawn the way `TablerGlyph` draws it: 24 grid, stroke 1.7, `currentColor`. Nothing is hand-drawn or AI-made. The colours and sizes come from `src/ui/theme/tokens.css` and `src/index.css`.

## The pages

1. **The type chart button.** Candidates: `dna` (today), `dna-2`, `chart-radar`, `arrows-exchange`, `swords`, `layout-grid`, `target-arrow`, `triangle`, plus `table` as an extra. Each is shown at 12, 16 and 20 px on `--panel` and `--card-body`, and in the real button, closed and open, at its real 16.25 px. Each has a one-line note on what it says. All nine exist in Tabler 3.49.0.
2. and 3. **Card tooltip effect icons and the two marks.** The 19 effect icons, the Requirements triangle and the met tick. Each is shown in its line at its real size, then on its own at its real size, at stroke 2, at 12 px, at 14 px, and filled (at its real size and at 14 px) where Tabler has a filled drawing.
4. **The status icons in the tooltip's "Statuses & keywords" lines.** Shown at 11 px (today), 12 px and 14 px, plus filled where Tabler has one.
5. **One whole tooltip drawn five ways:** today, stroke 2, 12 px, 14 px, and filled. Below it, a table of what each fix would cost in code.

## If Henry picks a type chart icon

Change one word in `src/ui/components/typeChartIcons.ts` (`toggle: 'dna'`). Then add the new name to `"outline"` in `scripts/tabler-icons.names.json` and run `npm run icons`. `swords` and `arrows-exchange` are already in the names file. Two tests pin `'dna'` and need the same word: `src/ui/theme/inlineIconMaps.test.ts` and `src/ui/components/TypeChart.icons.test.tsx`. `dna` can leave the names file once nothing uses it, but `InlineIcon.test.tsx` also renders `dna`.

## If Henry picks a tooltip fix

Size is the cheapest fix. `InlineIcon` already takes `size`, so `size="1.25em"` on `EffectLine` gives 14 px and still follows the Text size setting. Weight (stroke 2) needs a small new prop on `InlineIcon`. Filled is not a one-word change: `EFFECT_ICON` holds outline names only, and 8 of the 19 effect icons have no filled drawing. Page 5 has the details.
