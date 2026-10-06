# Ticket 194: What Henry's 2026-10-04 Rootfall run found

**Type:** one balance ruling (194a), one card ruling (194b), battle bugs (194c–194g), battle readability and feel (194h–194l), run screens (194m–194r). **Status:** written 2026-10-04 from `playtest-results/2026-10-04` (Henry's notes, the run log, 16 fight logs, the run-over screenshot). Nothing built. **Henry ruled decisions 1–8 the same evening** (see *Rulings* at the bottom); **decision 9 (194k, darken the stage) is still open.** The gym prep redesign moved to [ticket 195](201-gym-prep-mock.md).

**Where it comes from.** Henry played one full run and wrote 20 notes, then asked for a review. Every number below comes from `mingming_run_log.json` and the `mingming_fight_log_*_N.json` files (file N = fight N). The file and line pointers were checked against the tree at `0980f356`; line numbers drift, so search for the quoted names.

**Not part of this ticket:** the strength nerf (185, done the same day) and the agent playtester (193).

---

## The run

Rootfall, tier 0, no modifiers. About 58 minutes, 16 fights, won 15, **lost on gym fight 3 of 3**. The run-over screen reads "Reached biome 3 of 3 · 15 fights" (the lost fight is not counted).

| When | What |
|---|---|
| Start | fenrir_v1 alone, 8-card deck, 45 amber |
| Fight 6 (biome 0 town) | Summoned skoll_v1 (25 amber), sold three Tackles, two upgrades |
| Biome 1 town | Summoned ratatoskr_v2, bought Unbound Fang+, three upgrades, ended at 0 amber |
| Biome 2 town | One buy, four upgrades, **entered the gym with 5 amber** |
| Gym gate | Free upgrade (Flare Burst+) and one free rune (Splitter on Fenrir) |
| Gym 1 (huldra_v1) | Won in 2 turns, nobody died |
| Gym 2 (huldra_v2) | Won in 2 turns. **Fenrir died on enemy turn 1** and came into gym 3 at 0 HP |
| Gym 3 (huldra_v2) | **Lost.** Skoll died on enemy turn 1; turn 2 dealt 0 damage |

Compared with 2026-10-02 (turn-1 wins, "Fenrir and Skoll v1 are both very OP"), biome-0 wild fights took the full 3 turns and solo Fenrir dropped to 163 of 1155 in fight 4.

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **One commit per row,** `npm run gate` green first. Stage explicit paths only, authored as Henry, no push.
4. **Rows marked *Henry* do not start until he rules.**
5. **Small single-purpose modules, composed** (Henry's standing preference). A fix is one new small module or one changed function, not an addition to a large file.

| Row | What | Kind |
|---|---|---|
| 194a | Enemy Huldra v2 gets her Elderwood Ward shield **before** her first action, and Bark Smash cashes it for 924–1419 damage | Balance. **Ruled: A** |
| 194b | Ragnarok Edge+ only adds 10 power | Card design. **Ruled: 1.5 per 1% on +, no cap on either** |
| 194c | Bark Shield fractions leak into the preview chip (`4.00000001`) and into Bark Smash's count (`47.863…`) | Bug |
| 194d | Two Huldras: the second one seemed to get no shield | Probably a display bug; check first |
| 194e | The HP damage preview is hidden in the plaque's overflow | Bug |
| 194f | Fenrir's Instinct chip shows two tooltips | Bug |
| 194g | The first Mingming shows as selected at battle start, but is not | Bug |
| 194h | You cannot tell which enemy your card's preview is for | Readability. **Ruled** |
| 194i | "Can't see the status appliers": the status VFX, mostly the trails | Readability. **Ruled; built in 194k** |
| 194j | No at-a-glance sign of which Instinct version a unit runs | Readability. **Ruled: a glyph per Instinct** |
| 194k | The game does not look like the Battle Juice Lab: effects small and faint on the light stages, damage numbers thin, status landings hard to see, lag on a multi-hit that kills | Feel. Stage dim is **Henry** |
| 194l | Heals use the attack sound; recoil plays a second sound | Sound. **Ruled: recoil quieter** |
| 194m | The map tooltip is unstyled | Bug |
| 194n | The town square should be a 2×2 grid, without the tabs that repeat it | Screen |
| 194o | Sell tiles need the count, deck vs collection, and a "sold" response | Screen |
| 194p | Runes cannot be seen on the map, shop, roster, loadout or gym prep | Screen. **Ruled: everywhere a Mingming is shown, plus Totems on the loadout** |
| 194q | The gate's "Pick a bonus (choice of two, free)" reads as two runes | Copy |
| 194r | The gym prep screen needs a redesign | **Moved to [201](201-gym-prep-mock.md)** |

---

## 194a: Enemy Huldra v2 shields before she acts, then Bark Smash one-shots (ruled: A)

**Ruled (Henry, 2026-10-04):** *"Go with A, Leave the bark smash as is for now."* Build option A below. Bark Smash keeps 6 power per stack (10 upgraded); options B and C are dropped.

**What was seen.** Huldra v2 killed three party members, including both gym deaths:

| Fight | Enemy | Bark Shield cashed | Bark Smash damage | Result |
|---|---|---|---|---|
| 11 (elite) | ratatoskr_v1, huldra_v2 ×2 | 75 stacks (50 own + 25 from the other Huldra) | 1,419 | Skoll dead, enemy turn 1 |
| 15 (gym 2) | ratatoskr_v1, huldra_v2, kraken_v2 | 47.86 stacks | 924 | Fenrir dead, enemy turn 1 |
| 16 (gym 3) | huldra_v2, ratatoskr_v2, jormungandr_v2 | 50 stacks | 1,007 | Skoll dead, enemy turn 1 |

The party's max HP is 1,125–1,155. In fight 16 the same Instinct also gave Ratatoskr and Jörmungandr 25 stacks each, so **the player's turn 2 dealt 0 damage** (every hit absorbed). Gym 1, against huldra_v1, lost nobody.

**The cause.** `huldra_v2_bark_end` in `src/engine/core/CustomFirmware.ts` is an `onTurnEnd` hook guarded to fire once. The comment above it explains that a battle opens in the player's action phase, so "EVERY unit's first boundary is a turn END, on both sides", and that a turn-START shield would be "a real buff" because it protects the owner's own actions. That holds for a **player** Huldra: the first turn end is her own, after she has acted. For an **enemy** Huldra the first turn end is the **player's**. The fight logs show it: `--- PLAYER ends their turn ---`, then `Huldra gains BarkShield (50 stacks)`, then the enemy turn opens with Bark Smash. So the enemy version already has the buff the comment warns against, and the player gets no turn between the shield appearing and it being cashed.

`bark_smash` (`programs.json`) is 6 power per stack consumed (`bark_smash+` 10). 50 stacks is 300 power.

The armed-pip text in `src/ui/counters/counterDisplays.ts` says "Raises its Bark Shields at the end of Huldra's first turn", which is wrong for an enemy Huldra.

**Options.**

- **A (recommended). Fire the shield at the end of the owner's own side's turn.** Side-filter the hook: an enemy Huldra shields at the end of the enemy turn, a player Huldra is unchanged. Her first-turn Bark Smash then has only what Heartwood gives (6 a card). The wall lands where the player can see it, and gets a full turn to hit into it or kill her allies before it is cashed. Fix the pip text in the same commit.
- **B. Keep the timing and cap the payoff.** For example, Bark Smash counts at most N stacks, or the Instinct's grant is marked so a consume does not count it. Leaves the enemy shield before the player can act.
- **C. Keep both and telegraph it.** The enemy's hand already shows; add a warning on the threatened unit. No balance change; the one-shot stays.

**After the change:** the Rootfall gym boss numbers (ticket 72's lineup, ticket 77's measurements) were taken with today's timing. Re-run the Rootfall boss cell after the change and report the move.

**Tests.** An enemy huldra_v2 has no Bark Shield when the enemy turn starts, and has it at the end of that turn; a player huldra_v2 is unchanged (shield at the end of the player's turn 1). The pip text names the right turn for each side.

---

## 194b: Ragnarok Edge+ should grow its scaling, not its base (ruled)

**Henry:** *"Ragnorock's edge should increase the % damage on upgrade. it just adds 10power which is not very interesting."*

**Today** (`programs.json`): `ragnarok_edge` is "20 power. +1 power per 1% of your max HP missing (max 50%)". `ragnarok_edge+` is "30 power", same scaling. It is fenrir_v1's signature payoff (`startKits` in `mingmingRegistry.ts`).

**Options that were offered.** (1) +1.5 power per 1% missing, cap 50%. (2) +1 per 1%, cap raised to 75%. (3) both, with the base back to 20.

**Ruled (Henry, 2026-10-04):** *"1.5 power, but lets remove the cap from the base and the upgrade. The card isn't very strong right now."*

**Build.**

- `ragnarok_edge`: 20 power, +1 per 1% of max HP missing, **no cap**. Description: "20 power. +1 power per 1% of your max HP missing."
- `ragnarok_edge+`: 30 power, **+1.5** per 1% missing, **no cap**. Description: "30 power. +1.5 power per 1% of your max HP missing."
- **Read this way:** the 1.5 is the upgrade's, and the upgrade keeps its 30 base because the card needs strength, not less. If Henry meant 1.5 on both, or the + back to 20 base, it is a one-line data change.
- **The cap is shared.** `MISSING_HP_PCT_CAP = 50` in `ActionExecutors.ts` applies to every `MISSING_HP` scaler: `ragnarok_edge`, `ragnarok_edge+`, `bloodlust` and `last_rites`. Only Ragnarok Edge was ruled, so add a per-action override (for example `"scalingCap": null` on the action, read by the `MISSING_HP` branch) rather than changing the constant. Bloodlust and Last Rites keep 50%.
- **Floor the power.** 1.5 × a fractional percent is fractional; floor the scaled bonus, as the other scalers do.
- The comment on the constant says the cap is "budget / scalingPower" for the power-scale tooling. Update whatever fixture or powerscale entry prices Ragnarok Edge, and say in the commit what it now charges.

**Tests.** At 80% of max HP missing: `ragnarok_edge` gets 20 + 80 = 100 power; `ragnarok_edge+` gets 30 + 120 = 150. `bloodlust` at 80% missing still reads 50%. A fractional missing percent gives whole power.

---

## 194c: Bark Shield fractions leak into two places

**Henry:** *"Removing barkshield still shows a large number in the preview like 4.00000001."*

**The cause.** Bark Shield stacks are a percent of max HP stored as a float (`BarkShieldBehavior.onPostDamage` in `src/engine/StatusBehaviors.ts` stores `shieldPercent - absorbedPercent`; the decay multiplies by 0.8). That is on purpose. Two readers do not account for it:

1. **The preview chip.** `statusDiff` (`src/ui/utils/damagePreview.ts`) subtracts raw stacks, and `statusChipText` (`src/ui/utils/statusOverflow.ts`) prints the raw delta. The badges and tooltips already round through `displayStacks` (`src/ui/components/displayStacks.ts`, ticket 183a); the chip does not.
2. **Bark Smash's count.** The consume path in `ActionExecutors.ts` (`const consumedStacks = existingStatus ? existingStatus.stacks : 0`) feeds `lastStatusConsumed` unfloored, so fight 15 logged `Huldra's BarkShield consumed (47.863247863247864 stacks)`. The `BARKSHIELD_STACKS` scaler floors for exactly this reason ("FLOOR IS LOAD-BEARING", ticket 36). The final damage is floored afterwards, so no fractional HP lands, but the two scalers disagree.

**Build.** The chip prints through `displayStacks`, and a delta that rounds to 0 drops the chip. Floor a consumed Bark Shield count the way `BARKSHIELD_STACKS` does, and round the number in the consume log line.

**Tests.** A Bark Shield of 4.00000001 removed shows `-4 BARKSHIELD`; 0.04 removed shows no chip. Consuming 47.86 stacks counts 47.

---

## 194d: Two Huldras, and the second seemed to get no shield

**Henry:** *"Two huldra's with the barksheild OS/instinct but the second one didn't get the shield?"*

**What the log says** (fight 11, file `_11.json`). The engine looks right: the Instinct fired twice (two `BARK_SHIELD_OS activates` lines), each Huldra got 50 on herself and 25 from the other, one cashed 75 into Bark Smash, and the other's shield later absorbed 38 ×4, 284, 251 and 148 before `Bark Shield broke!`.

**So check the display.** Play the fight 11 lineup (elite: ratatoskr_v1, huldra_v2, huldra_v2) and watch the second Huldra's shield bar (`src/ui/components/stage/barkShield.ts`) and status chip after the end of the player's turn. If both show, close the row as "engine and display agree"; if not, fix the display.

**Related.** The in-game combat log names both enemies "Huldra", which is why the log alone cannot say which one did what. 193f fixed the same thing in the playtester tool's report. Whether the in-game log should add "(1)"/"(2)" to duplicate names is a small call for the builder to raise, not a requirement here.

---

## 194e: The HP damage preview is hidden in the overflow

**Henry:** *"The HP damage preview is hidden in the overflow."*

**Today.** `UnitPlaque.tsx` (`src/ui/components/stage/`) puts the preview inline after the HP: `{shown.hp}/{maxHp} (-{previewDamage})` inside `stage-plaque-value`. With four-digit HP ("1140/1140 (-1007)") it runs past the plaque's width and gets cut off.

**Build.** Give the preview its own place that cannot be clipped: for example a line under the HP bar, or the "ghost" chunk of the bar plus the number above the plaque. Keep it inside the plaque's "a number the player has to read is never behind FX" z-order rule at the top of `stage.css`.

**Tests.** A render test with HP 1140/1140 and a 1,007 preview, at the narrowest plaque width the stage uses: the preview is in the DOM and not inside an element with `overflow: hidden`.

---

## 194f: Fenrir's Instinct chip shows two tooltips

**Henry:** *"Fenrir OS has two tool tips."*

**The cause, probably.** `FirmwareChip` in `src/ui/components/UnitReadouts.tsx` opens a portalled tooltip on hover of the whole chip, and the rune letter inside it (`hud-os-patch`) also has a native `title`. Fenrir had a rune (Splitter, from the gate) in the gym fights, so hovering the letter shows both. The portal tooltip already carries the rune line.

**Build.** Drop the `title` on `hud-os-patch`. While there: the tooltip still prints `v1.0`/`v2.0` and a "TECHNICAL READOUT // SECTOR 0" footer, both from the robot theme 183 moved away from. Remove the footer; the version text waits on 194j.

**Tests.** The chip with a rune renders exactly one element carrying the rune's description.

---

## 194g: The first Mingming shows as selected at battle start, but is not

**Henry:** *"First mingming UI shows as selected at battle start, but it isn't really selected."*

**Today.** Not traced yet. Start by finding what draws the "selected" look on a party plaque at mount (`BattleStage.tsx`, `StageSlot.tsx`, the stage's active-ally step) and what the hand uses as the caster when nothing has been picked.

**Build.** One source of truth for the current caster: the look follows the store, or the store starts with the first member chosen. The builder reports which before changing it.

**Tests.** At battle start, the plaque that looks selected is the caster the next played card uses.

---

## 194h: Which enemy is your card's preview for (ruled)

**Henry:** *"The enemy targeting is not clear. They don't get highlighted."*

**Two readings:**

1. **Picking a target for your card.** `TargetFlag` (`src/ui/components/stage/TargetFlag.tsx`) says nothing on a legal target until the pointer is on it ("A legal target says nothing until the pointer is on it"). Fix: while a card is held or selected, every legal target gets a soft outline, and the hovered one gets today's cursor.
2. **Seeing whom the enemy is about to hit.** During the enemy turn, the unit the next enemy card is aimed at gets a mark. That would also help 194a.

**Ruled (Henry, 2026-10-04):** *"I can't tell which enemy is being targeted for the preview of my card."* Reading 1. Reading 2 is not asked for.

**Build.**

- **The previewed target is unmistakable.** Whichever enemy the hover preview is computed for gets a strong highlight on its sprite and plaque (outline or glow in the Slant accent), alongside today's cursor, for as long as the preview shows. The preview numbers and the highlight never point at different units.
- **Every legal target gets a soft outline** while a card is held or selected, so the player sees the choices before hovering.
- **If a card picks its target for you** (a single-target card cast without choosing one, or a `RANDOM_ENEMY` card), the unit it will hit is the one highlighted; for a random target, every candidate gets the soft outline and none gets the strong one.
- One small `targetHighlight.ts` that answers "which unit ids are strong, which are soft" from the held card and the hover, read by `StageSlot`; `TargetFlag` stays the cursor and the effectiveness words.

**Tests.** With a card held: every legal enemy is soft. Hovering one makes it strong and the others soft, and the preview's target id equals the strong id. With no card held, nothing is outlined.
---

## 194i: "Can't see the status appliers" (ruled: the status VFX; built in 194k)

**Two readings:** (1) when a status lands, nothing visible shows it landing (190 added "status landings"; check they show on Showy); (2) a card or hand preview does not show which statuses it will apply. Henry says which; the builder takes it from there.

**Update 2026-10-04 (chat):** Henry says the status landings are *"small and almost impossible to notice"*. Making them visible is now 194k-4 and 194k-5.

**Ruled (Henry, 2026-10-04):** *"The VFX for statuses, its hard to see the trail VFX. The other agent will hopefully address this."* Reading 1; reading 2 is not asked for. **No separate build here.** The 194k builder should check that the **trail** from caster to target (not only the landing) gets the 194k-3 contrast and the 194k-5 sizes, and include a status trail in the 194k-8 captures. This row closes when Henry signs off those captures.

---

## 194j: Which Instinct version a unit runs, at a glance (ruled: a glyph per Instinct)

**Henry:** *"The OS need some indicator so at a glance I know which version it is. Either a icon or text like before we had v1 and v2 although it doesn't make sense anymore to have that."*

**Today.** 182a removed the V1/V2 label from the chip ("a balance label, not a player's"). Every Instinct now has a Norse name (`src/ui/labels/instinctNames.ts`, 183i).

**Options that were offered.** (1) A short Instinct name on the chip or under the plaque name. (2) One glyph per Instinct (33 glyphs; art cost). (3) A small two-shape mark per species.

**Ruled (Henry, 2026-10-04):** *"Maybe a glyph that players will learn."*

**Build.**

- **Step 1, a glyph sheet for Henry.** One simple glyph per Instinct (33, one per entry in `instinctNames.ts`), drawn in the same closed icon set as `Icon` (ticket 34), single-colour so the chip can tint it by element. The shape should hint at what the Instinct does (a shield for Elderwood Ward, a coil for Jörmungandr's draw, and so on), and the two Instincts of one species must look clearly different at chip size. Henry approves the sheet before it is wired.
  - **Step 1 done 2026-10-05; step 2 waits for Henry.** The sheet is [`results/194j/glyph-sheet.html`](../../../../results/194j/glyph-sheet.html) (33 glyphs, each at 84 px and at chip size, the two Instincts of a species side by side, tinted by element). The geometry is in `results/194j/glyphs.json` (24 px grid, stroke only, 1.7, round caps), ready to become `IconName` entries and `instinctGlyphs.ts` once approved. Nothing is wired and no `v1.0`/`v2.0` text has moved.
- **Update 2026-10-05 (Henry): the glyphs count as AI-generated art. Henry first meant to draw them himself, then (2026-10-06) ruled to use AI-drawn glyphs for the 12 Instincts of the 1.0 release and disclose it on Steam. Step 1's sheet is not used; step 2 moved to [ticket 199](199-instinct-glyphs.md).** The text below is kept as the spec 199 carries over.
- **Step 2, wire it (now ticket 199).** `FirmwareChip` draws the owner's Instinct glyph instead of the generic `firmware` icon. The tooltip header shows the glyph beside the Norse name and drops the `v1.0`/`v2.0` text (194f left it for this row). Anywhere else an Instinct is named (retrain, summon, codex) shows the same glyph, so players learn it.
- One `instinctGlyphs.ts` map from Instinct id to glyph name, beside `instinctNames.ts`.

**Tests.** Every Instinct id in `instinctNames.ts` has a glyph, no two share one. The chip renders the owner's glyph; the tooltip has no `v1.0`/`v2.0`.

---

## 194k: Battle feel: make the game look like the Battle Juice Lab

**Update 2026-10-05 (Henry): *"I don't like the vfx fixes."* Built as written (194k-1 to 194k-8, commits left in place), but the look is not accepted and the 194k-8 captures were not a fair comparison with the lab. The second pass is [ticket 198](198-battle-vfx-follow-on.md). 194k-8 is not signed off and moves there (198c).**

**Henry (notes):** *"The VFX don't look like the mock. They look really small. Not as juicy."* · *"Damage numbers seem thin."* · *"VFX sometimes lag like on a multihit with a kill."*

**Henry (chat, 2026-10-04, with five screenshots):** *"How come the Battle Juice Lab artifact is different from what happens in game … it looks really bad compared to what the battle juice lab was doing."* · *"The status effects were small and almost impossible to notice … mostly its the trail vfx that is hard to notice."* · *"Basically I wanted everything to look like the lab."*

**What the screenshots show.**
- **Cinderreach, Fenrir's Glass Cannon into Fenrir (foe), 183 damage:** the flame beam is a thin pale line with a faint orange smear. In the lab it is a pouring column of flame.
- **Rootfall, Serpent Flurry and Bark Lash:** the water jet and the vine are thin lines.
- **Ratatoskr's "+1 Strengthened":** two tiny red chevrons and a label about 13 px high.

**Why the game differs from the lab.** 190 ported the lab's drawing code faithfully. For example, `flameBeam.ts` is the lab's `fxFlame` line for line. Five things around that code changed, and each makes the effects smaller or fainter. 190's resolution also says nothing was looked at in a browser.

1. **The damage scale `s` was tuned on 100-HP units.** Almost every size, length and count grows with `s = sqrt(damage ÷ maxHp ÷ 0.45)`.
   - **In the lab,** units have 100 HP. The default "Solid 22" hit is s = 0.70 and "Heavy 45" is 1.0.
   - **In the game,** units have 1,100–1,350 HP. Henry's 10-04 fight logs have 610 hits. The median is 50 damage (s = 0.31), the 75th percentile 103 (s = 0.45) and the 90th percentile 214 (s = 0.64).
   - **The result:** the lab's "Chip 6" is 6% of max HP, which is bigger than the game's median hit (4%). So every effect sits at the bottom of its range: beam width, pour length, particle counts, hit-stop and target shake.
   - **Code:** `FULL_HIT_FRACTION` and `damageScale` in `src/ui/vfx/tiers/tierProfiles.ts`.
2. **The big-hit thresholds moved from `s` to share of max HP.**
   - **In the lab,** the dim starts at s > 0.6 and the charge-up at s > 0.5 (lab lines `s > Pp.dimAt`, `s > Pp.chargeAt`). That is any hit of 16% of max HP or more.
   - **In the game,** 190's resolution changed both to shares of max HP: dim from 60% and charge-up from 50% (`isBigHit` in `choreo/bigHit.ts`). In the 10-04 logs that is about 1% of hits.
   - **Camera shake** stayed on share of max HP, 12% on Showy (`cameraShakeFrom`, `impact/impactMath.ts`). It fires on 18% of hits.
3. **Light is drawn with normal blending, on a light stage.**
   - **In the lab,** beams, glows and embers use additive blending (`'lighter'`) over a dark navy stage. The beam is three see-through strokes (20%, 42% and 80% opacity) that add up into a glowing column.
   - **In the game,** light is drawn with normal blending (`source-over`): `LIGHT_BLEND` in `attacks/glow.ts` and `ParticleField.draw` in `particles.ts`. The comments there say additive vanished over the near-white card art. The biome backdrops are light too: Cinderreach sand and Rootfall's pale grey-blue.
   - **The result:** a 20%-opacity orange stroke over orange sand is invisible. Only the 2–5 px core shows, which is the thin line in the Glass Cannon screenshot.
   - **Switching back to additive will not fix it.** Adding light to a light background washes out. The effects have to bring their own contrast.
4. **The damage number never reads its profile size.**
   - **Not wired:** `TierProfile.damageNumberPx` (30–60 px on Showy) is defined and tested, but nothing reads it.
   - **In the game,** the float is a DOM span at a fixed 1.6rem (about 26 px) with a 2 px offset shadow (`.stage-sprite-frame .hud-float-damage` in `stage.css`, `.hud-float` in `index.css`). Status labels are 0.8rem (about 13 px).
   - **In the lab,** the number is drawn in italic 800 Barlow Condensed at 30 + 30s px, with a dark outline about 18% of the size. Status labels are 20 px with the same outline.
5. **The status landings and impacts were cut down.**
   - **Strength:**
     - **The lab draws** 7 chevrons (7–10 px) and 12 embers, and the whole sprite glows in the status colour for 450 ms.
     - **The game** (`landings/strengthLanding.ts`) draws 4 chevrons (5–7 px) and 5 embers.
     - **`stackFactor` then halves both counts** when the stacks top up a status the unit already has (`ADDED_SHARE = 0.5`). Ratatoskr already had Strength, so his "+1 Strengthened" drew 2 chevrons and 3 embers.
   - **Burn:** the lab draws 24 flames, the game 1–4 tongues.
   - **No body glow on any landing:** `spriteReaction.ts` has only the Poison and Weakened greying.
   - **Fire impact embers:**
     - **Size:** 3.5–6 + 2s px in `impacts/fireImpact.ts`, against 6–11 px in the lab.
     - **No hot centre:** the lab's glow sprite has a white centre, and the particle field's `rampAtlas` does not.
   - **The particle pool is too small:**
     - **Size:** `PARTICLE_POOL` is 600 particles, against the lab's 1,600.
     - **When it is full,** new particles overwrite the oldest. On a three-hit card that kills, earlier bursts can be cut short.

**Build.** One commit per part, test first. Small modules, as above.

- **194k-1. Re-tune `s` to the game's damage.**
  - Change `FULL_HIT_FRACTION` from 0.45 to **0.15**. On the 10-04 logs the median hit becomes s = 0.54, the 75th percentile 0.77 and the 90th percentile 1.0. That is close to where the lab's Chip and Solid sit.
  - Pours get longer: a median hit's Showy pour goes from about 270 ms to about 380 ms. Report the new Showy total for a median hit in the commit.
  - Re-base 190b's test ("45 damage takes 1,740 ms") on a game-sized hit.
- **194k-2. Put the big-hit thresholds back on `s`, as the lab has them.**
  - Dim from s > 0.6 and charge-up from s > 0.5 on Showy; 0.35 and 0.3 on Slow.
  - Camera shake from s ≥ 0.52 on Showy. That is the lab's 12% of max HP converted to `s`; on the new curve it is about 4% of max HP.
  - The camera punch keeps following the charge-up threshold, plus any kill.
- **194k-3. Give the light effects their own contrast.**
  - **Every light effect gets three layers:** first a dark rim (the element colour at about 30% brightness, normal blending), then an opaque body, then the hot core. This covers the flame beam, the water jet, the fire wall, the tidal wave, the glows and the embers.
  - **Raise the beam's outer stroke** well above 20% opacity.
  - **Add a white centre** to the particle field's glow sprite, as the lab's has.
  - **The vine and the bark planks are already opaque** with dark strokes. Only check their size.
  - **Check every element over all three biome backdrops and over a sprite.**
- **194k-4. Damage numbers and labels.**
  - The float reads `damageNumberPx(s)` for its font size.
  - Draw it in italic 800 in the display font, with a dark outline of at least 4 px (`paint-order: stroke` with `-webkit-text-stroke`, or a canvas draw as in the lab).
  - Status labels ("+1 Strengthened · Unbound"), SUPER EFFECTIVE and absorbed numbers go to about 20 px with the same outline.
- **194k-5. Status landings at the lab's counts and sizes.**
  - Port the lab's `statusLand` counts and sizes for all eight statuses.
  - Set `ADDED_SHARE` to 1, so a top-up lands as visibly as a fresh status. The ×N growth above one stack stays.
  - Add the 450 ms glow in the status colour on the body, as a `drop-shadow` filter through `spriteReaction`.
- **194k-6. Impacts and the pool.**
  - Match the lab's impact particle sizes for each element.
  - Raise `PARTICLE_POOL` to 1,600.
- **194k-7. Lag on a multi-hit that kills.**
  - Reproduce it with Acorn Toss or Flare Burst+ (three hits) where the last hit kills.
  - Check whether the death and the remaining hits queue behind each other on the battle clock.
  - Check whether the pool is overwriting live bursts (194k-6).
- **194k-8. Look at it, side by side.**
  - 190 closed on logic tests alone. This row closes on what it looks like.
  - Before closing, capture the same moves in the lab (Showy, 3v3) and in the game (Showy, Cinderreach and Rootfall):
    - a Flame Column of about 50 damage (4% of max HP);
    - a water jet;
    - a vine;
    - a Strength top-up of 1;
    - a three-hit card that kills.
  - Put the captures under `results/194k/` and link them here. Henry signs off on the captures.
  - **Captured 2026-10-05, awaiting Henry's sign-off (this row stays open until he gives it).** Each sheet is six frames at +0.25 to +1.9 s after the cast; left column the lab (Showy, 3v3), then the game on Cinderreach and Rootfall. Headless software rendering, so frame timing is approximate; the stage sheet gained `?hand=`, `?foeDefs=`, `?foe1/2/3=` and `?biomeName=` to set the scenes up.
    - [Flame, Cinder Lance (181 damage)](../../../../results/194k/flame.jpg) and [Flame, Ember Jab (48 damage, the ~50 case)](../../../../results/194k/flame50.jpg)
    - [Water jet, Venom Fang (76)](../../../../results/194k/water.jpg)
    - [Vine, Nettle Sting (58)](../../../../results/194k/vine.jpg)
    - [Strength top-up, Reckless Charge](../../../../results/194k/strength.jpg)
    - [Status trail, Poison Injection (the 194i check)](../../../../results/194k/poison.jpg)
    - [Three-hit kill, Flare Burst+ on a foe at 8%](../../../../results/194k/kill3.jpg): one merged freeze, the three hits land together (194k-7).
    - Honest notes for the sign-off: the lab's stage is dark navy and the game's is light, so the same effect reads less loudly in the game; the poison trail is a thin blue arc with a dark edge, visible on both biomes but much thinner than the lab's spore trail; the lab has no multi-hit, so the kill sheet has no lab column.

**Tests.**
- **`s`:** `damageScale(50, 1150)` is 0.54 ± 0.01.
- **Big-hit thresholds:** dim and charge-up read `s`, not share of max HP.
- **Damage number:** the float's font size equals `damageNumberPx(s)`.
- **Strength landing:** a top-up of 1 Strength draws 7 chevrons and 12 embers.
- **Glow sprite:** the centre pixel is white.
- **Pool:** `PARTICLE_POOL` is 1,600.
- **Beam contrast:** the beam's widest stroke is drawn with normal blending at 50% opacity or more.

**Henry:** decision 9 below (also darken the stage while an attack plays?).

---

## 194l: Sound: heals and recoil

**Henry:** *"I think heals still use the attack sound."* · *"Sounds seem to play twice. This comes from the fenrir recoil. So maybe not a bug."*

**Heals.** `useBattleVfx.ts` plays `castCue(element)` when any card is played, so War Pact (a Fire Skill whose low-HP branch heals) plays `castFire`; the `heal` cue only plays when the heal lands. **Build:** a card whose category is Heal or Skill gets a non-attack cast cue. A new `castCueFor(card)` beside `castCue` in `src/ui/audio/battleCues.ts`.

**Recoil.** Desperate Strike, Glass Cannon and the like play the impact on the target and then `recoil` on the caster (`causeCue`). `recoil` maps to the same `hit` sample as the impacts (`sfxSamples.ts`), which is why it sounds like the hit playing twice.

**Ruled (Henry, 2026-10-04):** *"Quieter."* **Build:** play `recoil` at a lower level than the impacts, starting at −9 dB through `gainForDb` (`limiters.ts`), and leave the number in one named constant so Henry can tune it by ear. **Test:** the recoil cue's gain is below the impact cue's.

---

## 194m: The map tooltip is unstyled

**Today.** `RegionMap.tsx` uses SVG `<title>` for the node hover (`hoverOf(laid)`) and for "Totem at stake". Those are native browser tooltips.

**Build.** A small portalled `MapNodeTooltip` in the Slant style, the way `StatusTooltip` does it, opened on node hover and focus. Keep the text in the accessible name for screen readers.

---

## 194n: The town square as a 2×2 grid, without the repeated tabs

**Henry:** *"The town looks wrong. It was supposed to be a 2x2 grid of four buttons, hide the redundant tabs when at this view."*

**Today.** `TownShell.tsx` always draws the left rail of building tabs, on the square too, so the square shows each building twice. The grid in `TownNode.css` is `repeat(auto-fit, minmax(220px, 1fr))`, so it is 4×1 or 3+1 depending on width. "LEAVE TOWN" and the amber count also appear twice (top bar and dock).

**Build.** On the square: no rail, `grid-template-columns: repeat(2, 1fr)`, one LEAVE TOWN. Inside a building, the rail stays.

**Tests.** The square renders four building buttons and no `town-rail`; a building tab renders the rail.

---

## 194o: Sell tiles: count, pile, and a "sold" response

**Henry:** *"Sell cards need to show the card count and if its in the deck vs collection. Also some sort of animation or confirmation it was sold."*

**Today.** `MarketplaceNode.tsx` already stacks duplicates and passes `deck`/`collection` and `×N` to `CardFace` as `tags`, but Henry did not see them, so on the tile they are too small or hidden. A sale plays `rewardClaim` and the count changes or the tile vanishes, with nothing else.

**Build.** A clear plate on the tile ("DECK ×3" / "COLLECTION"). On sale, a brief "+5 amber" float from the tile to the amber count, or a "SOLD" stamp before the tile updates.

---

## 194p: Runes cannot be seen outside battle (ruled)

**Henry:** *"I don't think I can see the runes anywhere in the map/shop/roster/load out/gym prep screen. So I can't tell what I already have."*

**Today.** A rune shows only as the letter on the in-battle Instinct chip and in the battle rewards (`PatchHolders.tsx`, 167j). Nowhere else.

**Ruled (Henry, 2026-10-04):** *"On the load out screen and anywhere else we see the mingming, we should also see what rune it holds. We should see the Totems somewhere as well probably loadout."* Draughts were not asked for.

**Build.**

- **One small `RuneTag`** (the rune's name, or its letter where space is tight, with the per-Instinct rune text as its tooltip), shared by `PatchHolders` and every new place. No screen writes the line itself.
- **Everywhere a Mingming is shown in a run gets it,** loadout first: the loadout editor, the ranch roster, the town's party rows (shop, upgrades, den), the map's party strip, the gym gate (201's mock includes it), and the summon and retrain screens. The builder lists any other place found and adds it.
- **Totems on the loadout screen.** The run's Totems as a row of named tags with their rule as a tooltip, the way the ranch's Vault section lists them. Totems belong to the run, not to one body, so they sit once on the screen, not on each member.

**Tests.** A run member with a rune shows its `RuneTag` on the loadout editor, the roster and the town party rows; a member without one shows nothing. The loadout screen lists the run's Totems, and shows nothing when there are none.

---

## 194q: The gate's rune copy reads as two

**Henry:** *"Gym rune offer says Pick a Bonus (choice of Two, Free) but only gave me one."*

**What happened.** One rune per gate visit, chosen from two per body, is the rule (163 §3, 166e). Henry got it (Splitter on Fenrir) and, separately, the gate's free upgrade (Flare Burst+). The heading in `PatchBench.tsx` reads `Pick a bonus` `(choice of two, free)`.

**Build.** Change the heading to say one: for example "Free rune: pick one". Update `copyBudget.test.tsx` ("the bonus is called Pick a bonus").

---

## 194r: The gym prep screen needs a redesign (moved to ticket 201)

**Henry:** *"Gym prep screen probably needs a redesign."*

**Today.** `GauntletNode.tsx` stacks: edit loadout (fight 1 only), the free rune bench, the free upgrade bench, and "Begin fight N of 3". No sign of the party's HP, runes (194p) or what the gauntlet holds.

**Next step.** A design pass, not code: a mock in the Slant kit showing party with HP and runes, the two free picks side by side, the three fights ahead, and one Begin button. Henry approves the mock before building.

**Ruled (Henry, 2026-10-04):** *"Yes do a mock, this is probably its own card."* Moved to [ticket 201](201-gym-prep-mock.md). Nothing to build here.

---

## Rulings (Henry, 2026-10-04)

1. **194a:** *"Go with A, Leave the bark smash as is for now."*
2. **194b:** *"1.5 power, but lets remove the cap from the base and the upgrade. The card isn't very strong right now."*
3. **194h:** *"I can't tell which enemy is being targeted for the preview of my card."*
4. **194i:** *"The VFX for statuses, its hard to see the trail VFX."* Covered by 194k.
5. **194j:** *"Maybe a glyph that players will learn."*
6. **194l:** *"Quieter."*
7. **194p:** *"On the load out screen and anywhere else we see the mingming, we should also see what rune it holds. We should see the Totems somewhere as well probably loadout."*
8. **194r:** *"Yes do a mock, this is probably its own card."* Now ticket 201.

## Rulings, 2026-10-05 (on the build report)

- **194k (VFX):** not accepted. A follow-on ticket, [198](198-battle-vfx-follow-on.md). The 194k commits stay in place until 198 rules on them.
- **Decision 9 (stage dim):** leave it for now.
- **194k-7 (multi-hit kill):** keep the single merged freeze as is.
- **194j (glyphs):** first ruled Henry-drawn; **re-ruled 2026-10-06: use the AI-drawn glyphs for the 12 Instincts of 1.0 and disclose on Steam.** Wiring moved to [199](199-instinct-glyphs.md).
- **194b:** remove the cap from **both** Ragnarok Edge and Ragnarok Edge+ (as built).
- **194g, 194h, 194d judgment calls:** fine. **194l, 194m, 194o, 194p design choices:** fine.
- **Re-pinned goldens** (aiDeterminism, ghostWalk, draftPolicy, one report fixture seed): Henry unsure; no decision needed, they are the files' own re-pin policy.

## Still open

9. **194k (Henry, 2026-10-05: "Leave it for now"; carried to [198](198-battle-vfx-follow-on.md)):** should the stage also darken slightly while an attack plays? That would use the 190g dim layer at low opacity on every attack, not only big ones. It is the lab's dark-stage look, but it changes the art direction. Recommended: no. Do 194k-3 first, then decide from the 194k-8 captures.

## Done when

Every row is built, ruled out, or moved to another ticket with a note here (194k's second pass is [198](198-battle-vfx-follow-on.md); 194j's glyphs are [199](199-instinct-glyphs.md); 194r is [201](201-gym-prep-mock.md)), and a Rootfall run against huldra_v2 shows the 194a change working.
