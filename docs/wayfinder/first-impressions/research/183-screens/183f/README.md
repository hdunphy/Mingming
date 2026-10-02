# 183f screenshots: the other screens

Each screen at 1280x800 and 1920x1080 (D7). Everything but the starter is mounted by the dev-only
screen sheet over a believable save (three assembled mingmings, a few blueprints, two runs done):
`npm run dev`, then `/Mingming/screens.html?view=ranch&section=expedition|roster|assembly`,
`?view=runstart`, `?view=settings`, `?view=summary&outcome=victory|defeat|abandoned`. The starter is
the real first screen at `/Mingming/` with a fresh save.

- `starter/` the three starters as `CardFace`: the monster's HP, Attack and Defense (species base
  numbers, bars to a common scale) where a card prints its rules, the flavour line on the tag line,
  the element's colour on the header and the foot. The two switches are small display labels below.
- `ranch/` the tabs (yellow when open), the gym offers as navy plates with a hexagon for each step,
  the roster plates, the type chart open (`roster-*`), the assembly bay and its Instinct picker
  (`assembly-*`, `assembly-picker-*`).
- `run-start/` the party step: the picked member wears the yellow edge.
- `settings/` the panel at the top and scrolled to the bottom, where the Game group shows the Show
  tips switch beside Show advanced content.
- `run-summary/` three large plates and the yellow button, for a win and a loss.

Not painted here (not in the row): the Firmware terminal modal, the Codex tab, the Vault tab (it is
empty without a run in progress), and Settings' own long paragraphs, which 182 did not cut.
