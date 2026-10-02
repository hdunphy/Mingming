# Playtest review: 2026-09-26, Rootfall, fenrir_v2 start (the first gym clear)

Reviewed by Claude from the exported run log, the 14 fight logs, the ranch save and `Gym success.PNG`. `notes.md` is empty, so everything below comes from the log; the questions only you can answer are at the end.

## What happened

- **Won the run.** Rootfall cleared in 14 fights with 14 wins; the party was fenrir_v2, sköll_v2 and huldra_v1. This is the Fire-led counter route the session card asked about, and **it works**. The gym's three fights each took 3 turns, and nobody was knocked out in the gym.
- **74 minutes of play, spread over 11h 12m on the clock.** The target run length is 35–45 minutes. The summary screen also flags 14 fights against its 10–13 target.
- **Deck of 24 at the gym**, inside the ruled 20–25. It grew almost entirely by **adding** cards: 26 reward picks (some went to the collection) against only 2 cards sold (both Tackles). The 09-24 ruling said it should grow "mostly by replacing".
- **Other spending:** 6 upgrades (Ignite, Thermal Overload, Cinder Lance, Cinder Armor, Flashover, and Bolster at the gym gate for free) and 3 patches (Splitter, and two Amplifiers).
- **110 scrap left unspent at the end**, with 2–4 blueprints banked for each of four species on top.

## The difficulty curve, fight by fight

| # | node | party | enemy damage dealt | outcome |
|---|---|---|---|---|
| 1 | wild (opener) | Fenrir | 708 | won; Fenrir on 55% HP |
| 2 | wild | + Sköll (recruited at the first workshop) | 1,002 | won; Sköll on 63 HP |
| 3 | **elite** (biome 0) | 2 bodies | 1,738 | won; **Sköll knocked out** |
| 4–5 | wilds (biome 1) | 2 | 496, 307 | won, both near full HP |
| 6 | rival | + Huldra | 1,186 | won; **Huldra knocked out** |
| 7–11 | wilds and elites (biomes 1–2) | 3 | 190, 164, 342, 1,018, 363 | won, mostly at full HP |
| 12–14 | **gym** | 3 | 586, 1,512, 634 | won, 3 turns each |

The only threat in the run came in fights 1–6, while the party had one or two bodies. **Once the third body arrived, the run stopped pushing back.** Across fights 7–14 the enemy dealt 164–1,512 damage per fight into a party with about 3,500 HP, and every one of those fights ended in 3–4 turns.

## Likely reasons it went soft after the recruits (for discussion, nothing changed)

1. **The AI beam bug is still live.** It was found in the 09-26 code review but left out of ticket 164. In every wild and elite fight, the enemy searches about one card deep. The gym is beamless, so this does not explain the gym.
2. **The counter route is doing exactly what it should.** Fire beats Rootfall's Nature leader. The gym criteria page (§6) says a gym is "in" when you beat it with its counter party **and lose to it with a non-counter party**. This run proves the first half. The second half needs its own run.
3. **The big balance numbers are stale.** The per-deck win rates predate the enemy first-hand fix and ticket 164. The last partial measurement read fenrir_v2 and sköll_v2 at about 90% against the field, and both are in this party.

## Minor, from the log

- **The event node on biome 0, layer 3 did nothing.** Events are the known missing piece (steam-release ticket 30), so this is expected, but the map still draws the node.
- **Enemy first turns** averaged 7.7 cards and the player's 7.4. That matches the fixed draw rule (party size decides the hand), so the double-hand fix holds in real play.

## Questions only Henry can answer (the §4 prompts)

1. **Fight one:** did the opening five feel like a weak engine with one payoff, and did the first pick (Flashover) complete something?
    Yes it worked well I think
2. **The party:** name one moment the three bodies did something together that one could not have done alone.
    The synergy between the add statuses allowed me to get 20 sharp on the first turn very easily then using my scaling sharp attacks to wipe teams.
3. **The OS:** for each body, could you tell what its OS did from the tell alone?
    Not really. It took me a while to pick up  on those.
4. **Picks:** was there a reward screen where you wanted two things? Did an upgrade or a patch ever beat a card?
    Upgrades feel critical, I almost always tried to upgrade. The shop often didn't have the cards I wanted once I had a good deck. I didn't get any macros but probably should have.
5. **The scout:** did the preview change who you recruited or which way you went?
    No, I didn't really use the scout. Or don't understand if I was.
6. **The gym:** did it feel like the run's argument being settled, or like a wall?
    The argument except for the first WWF fight which felt out of place for this biome. 
7. **The worst minute:** where, if anywhere, did you feel done with the run before it ended?
    No it was actually very fun. 
8. **Play again, 1–5,** and the one thing that would raise it by one.
    4, it was a little too easy at the end. The OS patches feel very over powered. You should probably only have 1 or two by the end, I think I saw 4-5.

One note: This came before the 164 ticket. The playtime  was long because I would leave during the session and come back. It wasn't one sitting.