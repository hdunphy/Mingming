# Agent playtest night, 2026-10-08-primed-haiku

36 runs played, 12 won, 24 lost, 0 stopped by the decision budget, 0 cut short or unfinished. The driver reported 149,459,586 tokens, 198 minutes and about $6.11 in all.

| Party at the end | Sessions | Reached the gym | Won |
|---|---|---|---|
| 1 (solo) | 8 | 0 | 0 |
| 2 | 7 | 0 | 0 |
| 3 | 21 | 17 | 12 |

## Invariant failures (most likely bugs)

None.

## Surprises (a bug, or wording that misled)

- Bark Lash (card), 7 times. Printed text: "Bark Lash (0e, Nature): 1 power per point of Bark Shield you hold."
  Typical case: the agent expected {"hits":1,"kills":[],"status":{},"self":{},"draw":0,"energy":0,"created":0,"exhausted":0} and got {"hits":1,"kills":[],"status":{"Huldra (foe)":{"BarkShield":-4.8}},"self":{},"draw":0,"energy":0,"created":0,"exhausted":0}. Replay: `npm run playtest -- replay --results results/playtest/2026-10-08-primed-haiku --session r36 --to 49`
- Tackle (card), 4 times. Printed text: "Tackle (0e, None): 12 power."
  Typical case: the agent expected {"hits":1,"kills":[],"status":{},"self":{},"draw":0,"energy":0,"created":0,"exhausted":0} and got {"hits":1,"kills":[],"status":{"Huldra (foe)":{"BarkShield":-1.7}},"self":{},"draw":0,"energy":0,"created":0,"exhausted":0}. Replay: `npm run playtest -- replay --results results/playtest/2026-10-08-primed-haiku --session r36 --to 57`
- Thornguard (card), 4 times. Printed text: "Thornguard (1e, Nature): 20 power. Apply 3 Poison if you are shielded."
  Typical case: the agent expected {"hits":1,"kills":[],"status":{"Huldra (foe)":{"Poison":3}},"self":{},"draw":0,"energy":-1,"created":0,"exhausted":0} and got {"hits":1,"kills":[],"status":{"Huldra (foe)":{"Poison":3,"BarkShield":-3.6}},"self":{},"draw":0,"energy":-1,"created":0,"exhausted":0}. Replay: `npm run playtest -- replay --results results/playtest/2026-10-08-primed-haiku --session r36 --to 69`
- Heartwood (card), 1 time. Printed text: "Heartwood (1e, Nature): Gain 6 Bark Shield. Apply 1 Poison to the target."
  Typical case: the agent expected {"hits":0,"kills":[],"status":{},"self":{"Bark Shield":6},"draw":0,"energy":-1,"created":0,"exhausted":0} and got {"hits":0,"kills":[],"status":{"Huldra (foe)":{"Poison":1}},"self":{"BarkShield":6},"draw":0,"energy":-1,"created":0,"exhausted":0}. Replay: `npm run playtest -- replay --results results/playtest/2026-10-08-primed-haiku --session r36 --to 161`

## Runs

- r01: Unbound, gym Rootfall, run mode. defeat; 1 fight won, biome 1 of 3 (Emberglass Flats), 9 cards in the deck, 55 scrap left, party of 1, 0 blueprints unspent, ended at Wild, 3 decisions, 382,572 tokens, 1 minutes.
- r02: Muspel Wall, gym Rootfall, run mode. defeat; 3 fights won, biome 1 of 3 (The Slagfields), 16 cards in the deck, 25 scrap left, party of 2, 1 blueprint unspent, ended at Elite, 16 decisions, 1,283,569 tokens, 2 minutes.
- r03: Treachery, gym Rootfall, run mode. defeat; 1 fight won, biome 1 of 3 (Emberglass Flats), 9 cards in the deck, 55 scrap left, party of 1, 0 blueprints unspent, ended at Wild, 3 decisions, 381,571 tokens, 1 minutes.
- r04: Sunscorch, gym Rootfall, run mode. victory; 13 fights won, biome 3 of 3 (Verdant Sprawl Approach), 25 cards in the deck, 0 scrap left, party of 3, 9 blueprints unspent, ended at Gym, 60 decisions, 6,266,656 tokens, 9 minutes.
- r05: Abyssal Ink, gym Emberfall, run mode. victory; 13 fights won, biome 3 of 3 (The Slagfields Approach), 26 cards in the deck, 0 scrap left, party of 3, 11 blueprints unspent, ended at Gym, 59 decisions, 5,990,698 tokens, 7 minutes.
- r06: Tidal Crush, gym Emberfall, run mode. victory; 12 fights won, biome 3 of 3 (Cinderreach Approach), 28 cards in the deck, 15 scrap left, party of 3, 7 blueprints unspent, ended at Gym, 58 decisions, 5,261,609 tokens, 7 minutes.
- r07: Midgard Coil, gym Emberfall, run mode. defeat; 0 fights won, biome 1 of 3 (The Drowned Shelf), 8 cards in the deck, 45 scrap left, party of 1, 0 blueprints unspent, ended at Wild, 1 decision, 212,606 tokens, 0 minutes.
- r08: Venomfang, gym Emberfall, run mode. victory; 13 fights won, biome 3 of 3 (The Slagfields Approach), 26 cards in the deck, 20 scrap left, party of 3, 8 blueprints unspent, ended at Gym, 58 decisions, 5,704,189 tokens, 8 minutes.
- r09: Branch Gossip, gym Tidewrack, run mode. defeat; 4 fights won, biome 2 of 3 (The Drowned Shelf), 20 cards in the deck, 40 scrap left, party of 3, 1 blueprint unspent, ended at Elite, 40 decisions, 3,149,830 tokens, 4 minutes.
- r10: Tale-Bearer, gym Tidewrack, run mode. defeat; 11 fights won, biome 3 of 3 (The Saltmarch Approach), 28 cards in the deck, 0 scrap left, party of 3, 5 blueprints unspent, ended at Gym, 53 decisions, 4,853,978 tokens, 9 minutes.
- r11: Glamour, gym Tidewrack, run mode. defeat; 4 fights won, biome 1 of 3 (Verdant Sprawl), 17 cards in the deck, 15 scrap left, party of 2, 0 blueprints unspent, ended at Elite, 15 decisions, 1,083,818 tokens, 1 minutes.
- r12: Elderwood Ward, gym Tidewrack, run mode. defeat; 11 fights won, biome 3 of 3 (The Saltmarch Approach), 29 cards in the deck, 18 scrap left, party of 3, 4 blueprints unspent, ended at Gym, 55 decisions, 4,285,835 tokens, 15 minutes.
- r13: Unbound, gym Rootfall, run mode. defeat; 11 fights won, biome 3 of 3 (Rootmire Approach), 28 cards in the deck, 18 scrap left, party of 3, 5 blueprints unspent, ended at Gym, 57 decisions, 5,149,443 tokens, 6 minutes.
- r14: Muspel Wall, gym Rootfall, run mode. defeat; 1 fight won, biome 1 of 3 (Cinderreach), 9 cards in the deck, 55 scrap left, party of 1, 1 blueprint unspent, ended at Elite, 3 decisions, 389,486 tokens, 1 minutes.
- r15: Treachery, gym Rootfall, run mode. defeat; 1 fight won, biome 1 of 3 (Emberglass Flats), 9 cards in the deck, 55 scrap left, party of 1, 0 blueprints unspent, ended at Wild, 3 decisions, 383,243 tokens, 1 minutes.
- r16: Sunscorch, gym Rootfall, run mode. defeat; 4 fights won, biome 1 of 3 (Emberglass Flats), 21 cards in the deck, 20 scrap left, party of 3, 3 blueprints unspent, ended at Elite, 16 decisions, 1,174,674 tokens, 2 minutes.
- r17: Abyssal Ink, gym Emberfall, run mode. defeat; 11 fights won, biome 3 of 3 (Cinderreach Approach), 27 cards in the deck, 0 scrap left, party of 3, 3 blueprints unspent, ended at Gym, 68 decisions, 7,175,906 tokens, 8 minutes.
- r18: Tidal Crush, gym Emberfall, run mode. victory; 11 fights won, biome 3 of 3 (The Slagfields Approach), 26 cards in the deck, 35 scrap left, party of 3, 12 blueprints unspent, ended at Gym, 64 decisions, 6,391,462 tokens, 7 minutes.
- r19: Midgard Coil, gym Emberfall, run mode. defeat; 2 fights won, biome 1 of 3 (The Saltmarch), 10 cards in the deck, 65 scrap left, party of 1, 0 blueprints unspent, ended at Wild, 5 decisions, 446,808 tokens, 1 minutes.
- r20: Venomfang, gym Emberfall, run mode. victory; 13 fights won, biome 3 of 3 (The Slagfields Approach), 28 cards in the deck, 15 scrap left, party of 3, 9 blueprints unspent, ended at Gym, 59 decisions, 5,929,752 tokens, 8 minutes.
- r21: Branch Gossip, gym Tidewrack, run mode. victory; 9 fights won, biome 3 of 3 (Brinehollow Approach), 25 cards in the deck, 5 scrap left, party of 3, 6 blueprints unspent, ended at Gym, 68 decisions, 7,130,900 tokens, 10 minutes.
- r22: Tale-Bearer, gym Tidewrack, run mode. defeat; 7 fights won, biome 2 of 3 (The Saltmarch), 25 cards in the deck, 20 scrap left, party of 3, 3 blueprints unspent, ended at Elite, 35 decisions, 2,812,972 tokens, 8 minutes.
- r23: Glamour, gym Tidewrack, run mode. defeat; 3 fights won, biome 1 of 3 (Rootmire), 16 cards in the deck, 25 scrap left, party of 2, 1 blueprint unspent, ended at Elite, 18 decisions, 1,381,155 tokens, 2 minutes.
- r24: Elderwood Ward, gym Tidewrack, run mode. victory; 12 fights won, biome 3 of 3 (Brinehollow Approach), 27 cards in the deck, 60 scrap left, party of 3, 9 blueprints unspent, ended at Gym, 61 decisions, 6,222,116 tokens, 13 minutes.
- r25: Unbound, gym Rootfall, run mode. defeat; 12 fights won, biome 3 of 3 (The Thornwild Approach), 28 cards in the deck, 17 scrap left, party of 3, 1 blueprint unspent, ended at Gym, 56 decisions, 5,326,363 tokens, 7 minutes.
- r26: Muspel Wall, gym Rootfall, run mode. victory; 12 fights won, biome 3 of 3 (Verdant Sprawl Approach), 26 cards in the deck, 15 scrap left, party of 3, 12 blueprints unspent, ended at Gym, 62 decisions, 6,481,578 tokens, 7 minutes.
- r27: Treachery, gym Rootfall, run mode. victory; 12 fights won, biome 3 of 3 (The Thornwild Approach), 28 cards in the deck, 40 scrap left, party of 3, 10 blueprints unspent, ended at Gym, 61 decisions, 5,728,367 tokens, 6 minutes.
- r28: Sunscorch, gym Rootfall, run mode. victory; 12 fights won, biome 3 of 3 (The Thornwild Approach), 27 cards in the deck, 35 scrap left, party of 3, 7 blueprints unspent, ended at Gym, 64 decisions, 6,151,233 tokens, 8 minutes.
- r29: Abyssal Ink, gym Emberfall, run mode. defeat; 3 fights won, biome 1 of 3 (The Saltmarch), 16 cards in the deck, 15 scrap left, party of 2, 1 blueprint unspent, ended at Elite, 17 decisions, 1,359,221 tokens, 2 minutes.
- r30: Tidal Crush, gym Emberfall, run mode. victory; 14 fights won, biome 3 of 3 (Cinderreach Approach), 27 cards in the deck, 10 scrap left, party of 3, 12 blueprints unspent, ended at Gym, 61 decisions, 6,257,877 tokens, 8 minutes.
- r31: Midgard Coil, gym Emberfall, run mode. defeat; 3 fights won, biome 2 of 3 (The Slagfields), 12 cards in the deck, 60 scrap left, party of 1, 2 blueprints unspent, ended at Wild, 25 decisions, 1,859,547 tokens, 2 minutes.
- r32: Venomfang, gym Emberfall, run mode. defeat; 3 fights won, biome 1 of 3 (Brinehollow), 16 cards in the deck, 20 scrap left, party of 2, 1 blueprint unspent, ended at Elite, 17 decisions, 1,340,325 tokens, 2 minutes.
- r33: Branch Gossip, gym Tidewrack, run mode. defeat; 4 fights won, biome 1 of 3 (Rootmire), 17 cards in the deck, 35 scrap left, party of 2, 0 blueprints unspent, ended at Elite, 15 decisions, 1,329,654 tokens, 3 minutes.
- r34: Tale-Bearer, gym Tidewrack, run mode. defeat; 5 fights won, biome 1 of 3 (The Thornwild), 23 cards in the deck, 20 scrap left, party of 3, 2 blueprints unspent, ended at Elite, 19 decisions, 1,551,887 tokens, 4 minutes.
- r35: Glamour, gym Tidewrack, run mode. defeat; 4 fights won, biome 2 of 3 (Brinehollow), 17 cards in the deck, 50 scrap left, party of 2, 2 blueprints unspent, ended at Elite, 30 decisions, 2,391,776 tokens, 4 minutes.
- r36: Elderwood Ward, gym Tidewrack, card mode. defeat; 3 fights won, biome 1 of 3 (The Thornwild), 12 cards in the deck, 25 scrap left, party of 1, 1 blueprint unspent, ended at Elite, 164 decisions, 26,236,910 tokens, 14 minutes.

## The agent's notes

- Mingming: Fenrir (10 notes)
  - "Battle log oddity: the 'Biggest hits' summary lists Fenrir's attacks as hitting 'Fenrir (foe)' and also my own Fenrir, so I cannot tell which side took which damage."
  - "The HP figures are in the thousands (Fenrir 1140/1140, a single hit of 1000), yet the screen says HP full and the Elite fight took both of my Mingmings to 0 in 3 turns. I could not judge how much health was left, or how close I was to losing."
- Mingming: Jormungandr (9 notes)
  - "Run over at an Elite on The Drowned Shelf, lost to Kraken, Jormungandr and Jormungandr with 4 fights won and 40 amber unspent. Overall it felt hard to read: the screen said 'HP full' for all three of my Mingmings before the fight, yet the fight log showed Fenrir at 0/1095 after the previous Wild fight, and the damage numbers (1009, 1475) were far bigger than the 1110 HP the screen showed, so I could not judge how close a fight was. The one thing I would change first: make the HP and damage numbers agree on the screen, so a new player can tell when a team is in danger before it walks into an Elite."
  - "Skoll (Treachery) went to 0 HP in almost every fight from Brinehollow on, and the header kept saying 'HP full' for it at the next map and town screens (e.g. after the Wild fight with Jormungandr and Kraken, Skoll was 0/1155 but the header read HP full). I could not tell whether it was healed or still down until the gym screen said '0/1170 (down)'. The screen should say downed on the header too."
- screen: end (7 notes)
  - "Fights 1 to 3 were resolved for me with no moves to make, so I never chose a play in battle. The screen printed FIGHT WON and HP lines only. I could not tell from the screen whether this run hands me battles or not."
  - "On the map, the Elite node said 'stakes: BULWARK REFLEX' and the screen never explained what that means. I had no way to see the Elite's team before going in, and I had only 25 amber for the Ping Sweep or Survey that could have shown it. I went in blind and lost."
- event: Relay Tower (5 notes)
  - "The relay tower Survey option promised to show who waits in every fight in the biome, but the wording did not say what I would gain. I took the 20 amber instead without knowing what I gave up."
  - "At the Relay Tower I chose Survey (it says it shows who waits in every fight in this biome). After choosing it the screen only said 'This biome is surveyed' and showed nothing about the enemies, so I could not tell what I had bought with it."
- Mingming: Kraken (4 notes)
  - "Wild upper (the second route option, after Alpha and Elite) was a fight against Kraken, which beat my whole team. The screen said only 'Wild' with no hint of the enemy's element or strength, so I could not tell it was much harder than the two Wild fights before it. Nothing on the map showed I was risking a loss."
  - "Summoning Kraken at the Den added 5 cards to my deck at once, taking it from 11 to 16. The choice showed the +5 but not what it would do to my draws, and it felt like a big cost to get one body. The Abyssal Ink trace was the only one that fit my draw cards."
- card: Sap Strength (4 notes)
  - "Run over at the Tidewrack gym, lost fight 2 of 3 after 11 wins. Felt fair until the gate: fight 1 downed Huldra (Elderwood Ward) and Ratatoskr to 0 HP, the other Huldra was at 263, and the screen gave no way to use Revive before fight 2, so I started it with two members down and lost in 2 turns. The one thing I would change first: the screen must show when draughts like Revive fire, and let me use one between gym fights. Also odd on screen: Pile On+ and Sap Strength show hits of 900 to 1200 total, and an enemy's Seed Bomb hit its own ally for 932, which looks like a mistake."
  - "The fight log reads oddly: it lists Huldra's Sap Strength 'on Huldra (foe)' for 1180 damage and says Huldra 1184/1185 HP left, with my own Huldra also named Huldra. I could not tell which Huldra was mine, and the big number looked like a self-hit. The screen needs to name the two sides apart."
- Mingming: Huldra (3 notes)
  - "Den: the Huldra trace lists two instincts (Glamour and Elderwood Ward) with no sign of which one I would get, or whether I pick. Also each summon adds 5 cards to the deck, and the screen does not say which 5 cards. I cannot tell what I am buying before I pay 25 amber."
  - "After this win the log says Huldra HP left 608/1185, but the header still says 'HP full' and the screen says the team is healed between fights. I could not tell whether my Huldra was hurt and would heal before the next fight. Please make the header and the fight result agree."
- Mingming: Ratatoskr (3 notes)
  - "Run over at the first elite (TENTH STRIKE, three enemies: two Skoll and a Fenrir). Lost in 3 turns with all three of my Mingmings downed. My deck was 21 cards: the two Skoll traces and the Ratatoskr trace each added 5 cards, and I skipped the three Fenrir card rewards to avoid more bloat, so the deck was big and thin on damage. The summon screen says each summon adds 5 cards but not what that does to draw odds, and 'TENTH STRIKE' on the elite was not explained anywhere I could see. I also ended with 3 Traces and 20 Amber unspent, and the screen did not say whether a bench summon (25 Amber) was worth it. If I could change one thing first, it would be making each summon's card cost to the deck clearer before I commit to a team."
  - "After the Elite, the fight line said Ratatoskr (Branch Gossip) finished at 0/1110, but the header still read 'HP full' for every member, and no screen said Ratatoskr was down. I only knew from the fight line. The Revive draught then appeared. A downed-member marker in the header would stop me guessing."
- card: Ragnarok Edge (3 notes)
  - "Run over on the second fight: a wild Fenrir beat my Fenrir in 2 turns. The foe hit for 549 with Ragnarok Edge and 165 and 162 with Glass Cannon, while my Fenrir dealt about 276 with Flare Burst. The first fight, where I won, was also a big gap in my favour, so the difference between the two fights is not explained on screen. Overall it felt like a coin flip on which wild I met, with no information on the map to tell them apart. The one change I would make first: show each wild's team and rough power on the map or before the fight, so a new player can choose a route on purpose."
  - "Run over after two fights. The first Wild fight was against Skoll (foe) and the log read 'Skoll's Tackle on Skoll', so I could not tell which Skoll was which. The second Wild fight was against Fenrir, who dealt 708 in two hits with Ragnarok Edge, and I lost in three turns while Skoll was at full HP. Nothing on the route screen said Fenrir was the fight, or how strong the Wild fights would be, so I picked the upper route blind. The reward screen also offered Sun Devourer, which needs Strength, but the screen did not say whether my team had any. The one thing I would change first: the route screen should show what is behind each Wild node, or at least the enemy's name and rough threat, so a new player can tell a safe fight from a deadly one."
- card: Vent (3 notes)
  - "Elite stakes such as BULWARK REFLEX and FIRE TOTEM appear on the map with no explanation of what a stake is. The totem reward text ends with a double full stop. The Event said 'Pick 1 of 3 traces' but did not show what any of the three traces did before I chose one."
  - "Stray Mingming event: the screen said recruiting was free, but the deck went from 19 to 24 cards and the screen never said that Huldra on Glamour brings five cards with it. Also the Trace count went from 1 to 0 with no message about where it went."
- ...and 38 more (see the logs in results).

## Decision patterns

### Cards taken most often

- Battle Rhythm: taken 6 of 7 times offered. Reasons: Battle Rhythm deals 25 for one energy and gives 2 Strength when my side is above half health, which feeds Brute Force+ and Howl, so it is the strongest card on this screen for my deck.; Battle Rhythm gives 2 Strength while I am above half HP, which builds damage across a three-fight gym; Glass Cannon's 5% max HP cost hurts when repairs are only 30%..
- Flare Burst: taken 6 of 10 times offered. Reasons: Flare Burst does 30 damage across two hits for 1 energy, which is the most damage per energy on offer and my deck has few cheap attacks yet.; Flare Burst is 15 power twice for one energy with no self-damage, and I already have too many cards that cost me HP, so I take it..
- Hydro Blast: taken 6 of 8 times offered. Reasons: Hydro Blast hits for 120 in one card, the biggest single hit on offer, and the gym needs a finisher, though its 3 energy is a worry with one Mingming.; Hydro Blast is 120 Water power, the strongest single hit on offer, and my deck of 26 needs something that ends fights in one play; Riptide and Hoofbeat are auras that wait for enemy actions or 0-cost cards..
- Ink Cloud: taken 6 of 7 times offered. Reasons: Ink Cloud hits every enemy for 25 Water power and puts 2 Dazed on each, which is area damage (the gym fights always have three enemies) and feeds Crushing Depths; Venom Glut needs poison I rarely have.; Ink Cloud hits every enemy for 25 and applies Dazed to each, and the gym always has three enemies, so an area attack matters more there than a second Deep Scan, though it costs 2 energy..
- Venom Fang: taken 6 of 6 times offered. Reasons: Venom Fang does 30 for 1 energy with no condition, which is the most plain damage on offer for a Water team.; Venom Fang does 30 power for 1 energy, the most raw damage here, and I have little damage in an 8-card deck..
- Deep Scan: taken 5 of 14 times offered. Reasons: Deep Scan draws 2 for 1 energy, which helps a solo team find its attacks, while Mend heals only 20 and the screen says HP is fully restored between fights.; Deep Scan draws 2 for one energy, which helps the deck find its big Water hits; Blind Spot is only 6 power and Well of Mimir is an exhaust aura that does not help the turn..
- Fury Strike: taken 5 of 8 times offered. Reasons: Fury Strike gives Strength, and Brute Force gets +8 when I have Strength, so the two cards work together; Flare Burst and Unbound Fang have no such link.; Fury Strike is a 25 power Fire hit that also gives Strength, which feeds Brute Force and Skoll's Strength engine, so it is worth more to this team than Tide Pool or Pack Tactics..
- Nagging Bite: taken 5 of 6 times offered. Reasons: Nagging Bite does 35 to a Dazed enemy for one energy, and Heckle I already have applies Dazed, so the two work together; Rejuvenation only heals and draws.; Nagging Bite gets 20 more power against a Dazed target, and Kraken's Abyssal Ink puts Dazed on enemies, so the two work together; Mend heals but only one ally at a time..
- Pack Tactics: taken 5 of 8 times offered. Reasons: Pack Tactics does 23 damage three times with no Burn needed, which makes my attacks less dependent on the enemy already being Burning than a third Flashover would be.; Pack Tactics does 23 three times for two energy, the most damage on offer, and I need hitting power for the gym..
- Rejuvenation: taken 5 of 8 times offered. Reasons: Rejuvenation costs 1 energy, draws a card and heals, so it keeps the deck cycling and helps the team survive the gym.; Rejuvenation draws a card and heals, which helps a 28-card deck find its plays and keeps my team up, and it does not add more Weakened or Dazed I already have plenty of..
- ...and 66 more (see the logs in results).

### Cards passed over most often

- Berserkergang: passed over 15 of 15 times offered. Reasons: My deck is 24 cards already, and Hamstring is only 20 neutral power for one energy, which my Water attacks already beat; the two auras exhaust and do little on this screen, so I skip.; Tidal Battery costs 2 to give about 3 energy across the team, which is roughly break-even, and my deck is already at 25, so I skip..
- Capacitor: passed over 14 of 15 times offered.
- Riptide: passed over 14 of 18 times offered.
- Soothe: passed over 12 of 13 times offered. Reasons: My deck is already 18 cards and the big hitters are drawn less often as it grows, so none of these three is worth the dilution..
- Well of Mimir: passed over 12 of 12 times offered.
- Wisdom's Price: passed over 12 of 12 times offered.
- Forage: passed over 11 of 12 times offered. Reasons: None of the three helps my deck: Megingjord needs Strength I do not build, Eir's Remedy needs Poison, and Forage costs 15 HP from a Mingming whose HP I cannot easily repair before the gym, so I skip..
- Hoarder's Toll: passed over 11 of 11 times offered.
- Hoofbeat: passed over 11 of 13 times offered.
- Eir's Remedy: passed over 10 of 10 times offered. Reasons: None of the three helps my deck: Megingjord needs Strength I do not build, Eir's Remedy needs Poison, and Forage costs 15 HP from a Mingming whose HP I cannot easily repair before the gym, so I skip..
- ...and 91 more (see the logs in results).

### Shop items never bought

- Vent: on a shelf 45 times, never bought.
- Dwarf-Forged: on a shelf 34 times, never bought.
- Idunn's Apples: on a shelf 34 times, never bought.
- Berserkergang: on a shelf 27 times, never bought.
- Eir's Remedy: on a shelf 24 times, never bought.
- Forage: on a shelf 24 times, never bought.
- Riptide: on a shelf 24 times, never bought.
- Salve: on a shelf 24 times, never bought.
- Discharge: on a shelf 23 times, never bought.
- Venom Shot: on a shelf 23 times, never bought.
- ...and 109 more (see the logs in results).

### Upgrades taken

- Boiling Surge: 8 times.
- Flashover: 8 times.
- Brute Force: 6 times.
- Ink Cloud: 6 times.
- Venom Fang: 5 times.
- Battle Rhythm: 4 times.
- Brand: 4 times.
- Cinder Lance: 4 times.
- Ember Jab: 4 times.
- Hydro Blast: 4 times.
- ...and 38 more (see the logs in results).
