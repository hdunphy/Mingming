# 183c screenshots: the card in the Slant kit

One face, `CardFace`, drawn everywhere a full card shows (D2). Real components, real stylesheet.

- `hand-*` the battle hand, Fire biome, Fenrir casting. Fire cards match Fenrir, so their frame is
  orange (STAB); Growth is a Nature card, so its frame is ink. The foot is the readout strip (the
  figure, then "vs KRAKEN" / "to FENRIR") for cards that have a figure, and the 5px element bar for
  Ignite, which has none. `hand-selected-*` Ignite picked up: the yellow ring.
- `shop-*` the stall: price plate on the face, one SOLD tile greyed, the blueprint tile with no cost,
  an off-pool tag. The upgrade and sell columns beside it are the compact rows, unchanged in shape.
- `collection-*` the run collection's tile grid: `x3` badge, `pick` tag. Page 1 of 2.
- `deck-row-peek-*` hovering a deck row: the same tile as the collection.
- `upgrade-pair-peek-*` hovering an upgrade row: now, an arrow, upgraded. The number the upgrade
  changed (33 to 45) is the yellow highlight.
- `reward-*` the post-battle pick: three face-up, one picked (yellow ring), one face-down navy back,
  then the same face with no flip.
- `event-pick-*` the Data Fragments card pick with one card chosen.
- Every size is 1280x800 (Steam Deck) and 1920x1080 (desktop), the two sizes D7 asks for.

To retake them: `npm run dev`, then `/Mingming/cards.html?view=shop|loadout|reward|event` (dev only,
not a build input) and `/Mingming/stage.html?biome=Fire&card=card_0` for the hand. Hover a deck row
or an upgrade row to open the peeks.

Art slots are the hatch (the one allowed gradient) until art is commissioned.
