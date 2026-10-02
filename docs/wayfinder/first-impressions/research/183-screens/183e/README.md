# 183e screenshots: rows centred by party size

The Fire battle with a different number of bodies on each side.

- `3v3-*` the full battle: unchanged, row for row, from before 183e (a test pins it pixel for pixel).
- `2v2-*` two rows a side: they sit at y=147 and y=317, the middle of the arena.
- `1v1-*` one body a side: it sits at y=232, the middle row.
- `2v3-*` a lopsided battle: both sides keep the larger side's rows (the stage passes it), so the two
  sides still line up row for row and the smaller side sits at the top.
- Both sizes are 1280x800 and 1920x1080 (D7).

To retake them: `npm run dev`, open `/Mingming/stage.html?biome=Fire&party=2&foes=2` (dev only; `party`
and `foes` are 1 to 3).
