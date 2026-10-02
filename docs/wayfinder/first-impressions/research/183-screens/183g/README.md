# 183g screenshots: map and town pieces

The pieces for 176, each at 1280x800 and 1920x1080. They are mounted by the dev-only screen sheet
(`npm run dev`, then `/Mingming/screens.html?view=map` and `?view=town`), because 176 has not wired
them into `RegionMap` and the town screen yet: this row is the pieces, not the screens.

- `map-*` two biome panels (Water, Nature) with the label chip, and on the first one every node
  look: the start flag, wild fights ringed in the element, a rival, an event, an alpha detour, the
  town plate, the elite gate (a filled disc, 76px), a selected node (yellow ring) and faded ones.
  The gold road is the path walked, a road ahead takes its fight's colour, a detour is dashed.
- `town-*` the four buildings: Shop, Upgrades, Den (with the yellow READY tag) and Loadout.

The sheet draws a fixed 1280x800 stage, so the 1920x1080 shots show the same stage in a bigger
window and nothing more (the same holds for the other 183f/183g sheets). The first biome in the shot ends at an elite gate
because that is what the mock draws; the gym's node has no mock, so its crown is my drawing.
