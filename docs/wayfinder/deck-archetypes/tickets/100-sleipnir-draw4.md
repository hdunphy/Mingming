# Sleipnir draw-4 experiment (ticket 100): wide decks get more, weaker cards

- Type: wayfinder:task - Henry green-lit 2026-08-19 (ticket 88's recommendation; its
  after-playtesting gate is satisfied by rounds 1-2). Branch archetype-web.
- Status: **open**

sleipnir_v1 (designated ZOO, 36.8% field, 20 points behind her sibling): cardDraw 3 -> 4,
paid back in HER OWN cards' power (stampede-style cuts, ticket 88 measured the exchange at
~2-3 cards of power per draw point) until she lands ~45% field. Success = she plays 4+
cards a turn at a normal win rate AND feels like a different deck (Henry playtests the
result - the sim ranks this axis, only play judges it). If she feels the same, the idea
dies for the cost of one ticket; if it works, the recipe generalizes to every wide deck.
The three unused Air discard payoffs (feather_cache, sky_burial, carrion_swoop) are the
pre-identified buff levers if she lands short. Gates: band standard (neutral cells),
FTK 0, dead <=0.35; report cards/turn distribution before/after. ONE commit + a playtest
build note for Henry.
