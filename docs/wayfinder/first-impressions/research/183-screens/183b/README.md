# 183b screenshots: the battle stage in the Slant kit

Real `BattleArena`, real stylesheet, a 3v3 state with the things the stage has to draw dressed on:
Fenrir hurt with a Bark Shield (the brown number on its HP bar), a status of every kind on Skoll
(three chips and a `+3` chip for the rest), Kraken asleep, Huldra nearly dead, Nidhoggr terminated.

- `stage-nature-*` the room as the mock draws it (Verdant bands, kept from `183-mocks`).
- `stage-water-*` the Water band set. `stage-fire-aiming-*` the Fire set, with a card picked up and
  held over an enemy: the yellow arrow and the words ("Super effective" on Huldra) are the target
  feedback; the grey "Can't target" tag is on the dead unit.
- Every size is 1280x800 (Steam Deck) and 1920x1080 (desktop), the two sizes D7 asks for.

To retake them: `npm run dev`, open `/Mingming/stage.html` (dev only, not a build input, like
`kit.html`). `?biome=Fire|Water|Nature|None` picks the room.

The ART PENDING blobs stand where commissioned sprites go. The Water and Fire band colours are mine
(the mock only drew Nature) and are the first thing to judge.

Retaken 2026-10-02 after Henry's review: the plaque now shows up to six statuses (Skoll carries six: three
on the first line beside the energy hexagon, three on a second line), and the Water set is sampled from the
183 map mock's Brinehollow panel (the only drawn Water backdrop). Fire is still mine: no mock draws it.
