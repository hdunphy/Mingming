# Playtest review: 2026-09-27, Tidewrack, ratatoskr_v2 start

Reviewed by Claude from `notes.md`, the run log, the 20 fight logs, the ranch save and `final stats.PNG`.

## First: this run was played on the build from before ticket 166

The log proves it. Three things in it cannot happen on the current code:

1. **The gauntlet's first two fights.** I rebuilt this run's gym from its seed and rolled the three fights on both versions of the code:

   | Fight | What you fought | Old code (before 166c) | Current code (166c) |
   |---|---|---|---|
   | 1 | Fenrir, Jörmungandr, Sköll | Fenrir, Jörmungandr, Sköll | Jörmungandr, Kraken, Sköll |
   | 2 | Ratatoskr, Fenrir, Sköll | Ratatoskr, Fenrir, Sköll | Kraken, Jörmungandr, Sköll |
   | 3 (boss) | Jörmungandr, Kraken, Sköll | same | same |

   The old code matches your log exactly, species for species.
2. **Patches from the biome 0 and biome 1 elites** (fights 8 and 13). Since 166e only an elite in the final biome pays one.
3. **No macro pick after gauntlet fights 1 and 2** (166d).

Fights 11–20 were played after the 166 commits landed, so the game you were running was built earlier. That is most likely the desktop app from before `npm run desktop:build` was last run, or a dev server that was never reloaded. **Rebuild before the next session**, or the next review will be of old code again.

Several of your notes are about things 166 already changes. They are marked **(166)** below.

## What happened

- **Lost in the gym, on the boss's first turn.** 19 of 20 fights won. The party was Ratatoskr v2, Huldra v1 and Kraken v1. Jörmungandr v1 was recruited at fight 10, then swapped out for Kraken at the next workshop.
- **Gauntlet fight 1** (Fenrir, Jörmungandr, Sköll): the enemy's first turn dealt **1,195 damage** in nine cards (Ember Jab ×2, Pack Tactics, Flashover, Ragnarök Edge and more). Ratatoskr went down.
- **Gauntlet fight 2** (Ratatoskr, Fenrir, Sköll): won in 5 turns, but Huldra went down too. Kraken walked into the boss alone on 409 HP.
- **The boss** killed Kraken on its first turn (Boiling Surge ×2, Brand).
- **Two Fire bodies in fights 1–2 is why the run ended.** Two of your three bodies were Nature, and Fire beats Nature. On the current code each of those fights would have had one Fire body instead of two (the table above). Sköll is still in all three fights, because Tidewrack's authored boss fields it and its approach biome is Water+Fire.
- **The same pattern as 09-26:** 19 fights against the 10–13 target, and **137 scrap unspent** at the end. That is the second run in a row finishing with 100+ scrap in the bank.

## Your notes, one by one

1. **"Rat doesn't feel very strong to start."** Fights 1–5 took 4–6 turns each, and HP slid 1110 → 920 → 771 → 811 → 666. That's a slow start but not a dangerous one. On the old build the enemy's search bug made wild fights *easier* than intended; see note 8.
2. **Acorn Toss should hit more times.** Today it is 0 energy, 6 power twice (12). Its `+` is 6 power three times (18). Your 4×3 is the same 12 power in more hits; your 5×3 is 15. More hits is the real buff here, because Hoofbeat and other on-hit effects scale with the count. Whichever you pick, the `+` needs a new shape, because 6×3 would then be a small step. My suggestion: base 5×3, `+` 5×4. **Decision 1.**
3. **Not getting good cards in the first three rewards.** The offers were Pile On / Hoofbeat / Heartwood, Crippling Vine / Pollen Cloud / Thornguard, and Reactive Plating / Shrug Off / Harden Daemon. Three triples is too small a sample to call the pool broken. Hoofbeat was the engine card, and you took it. I'd watch this across more runs before changing anything.
4. **The enemy hand panel closes on the enemy turn; closed, the enemies should sit tight to the right, and opening it should push them over.** UI work, no decision needed beyond yours. It goes in the next ticket.
5. **Damage numbers overlap and leave too fast.** Each number lives 1.15 s and rises 86 px, and they share 6 horizontal slots 15 px apart. **166b makes this worse:** every status now adds its own float ("Sharp ×4") into the same slots. The fix is a longer life (about 1.8 s), a slower rise, numbers stacking upward instead of side by side, and statuses in a separate lane from damage. Next ticket.
6. **Bark Shield reads 1.3248929838928 on hover.** Found. When you hover a target, the card face shows an `ABS` chip (`HandCardFace.tsx`, line 152), and it prints the absorbed amount unrounded. Bark Shield is a percentage of max HP, so that amount is almost never whole. **The new 166b status float has the same bug:** it will print "Bark Shield ×1.32489…" whenever Bark Shield is applied. Both should round to a whole number. Next ticket.
7. **Workshop upgrade hover "spazzes out", and the sell/deck hover moves everything.** Same cause. Ticket 165a put the card preview as a block *under* the list, to dodge an old bug with fixed positioning (155h). The block grows the panel, the list moves under your mouse, the hover ends, the block goes away, and it repeats. Your fix is right: a tooltip beside the mouse, drawn outside every container. The status badges already do this (rendered straight into the page body). Next ticket.
8. **The enemy Rat played Seed Bomb badly, and the enemy left you on 5 HP to hit a full-HP body. (166)** Both are the AI search bug 166f fixed. Before it, wild and elite enemies only looked one card ahead. Seed Bomb scales with cards played before it, and a finishing blow two cards deep was invisible. The 5 HP was Huldra in the biome 0 elite (fight 8). Retest on the new build.
9. **Surge Protection should count draws by the whole team.** Today it counts only the caster's own draws, because of your 2026-08-30 ruling. That ruling was about Ink Stream's damage (party width was tripling it); Surge Protection's refund was changed at the same time to match. It is the only card that uses this check, so making it team-wide changes nothing else. **Decision 2.**
10. **A Dazed zoo deck: the scaling cards are all Water; add Nature ones?** Correct. Nature has the *conditional* payoffs (Nagging Bite +20 if Dazed, Pile On hits again if Dazed, Heckle to apply). Both *per-stack* scalers are Water: Slander (15 per stack) and Crushing Depths (20 per stack consumed). A Nature per-stack payoff is a new card, so that's a deck-design session rather than a fix. **Decision 3.**
11. **Undertow+ gives an extra Weakened.** A bug in how the upgrades were generated: the rule "+1 status stack" was applied to a debuff the card puts on *you*. I checked all 98 upgrades and Undertow is the only one this happened to. You offered two fixes: no Weakened, or draw 2. **Decision 4.**
12. **See which Mingming already has a patch on the reward screen, and what happens if you pick one that has one. (166, partly)** On the old build the patch was silently refused and lost. Since 166e the reward screen only offers the patch to bodies without one. Showing each body's current patch on that screen is still worth doing. Next ticket.
13. **"The first two battles of the water boss had two fire mingmings." (166)** See the table at the top.

## Decisions for Henry

1. **Acorn Toss:** 4×3 or 5×3, and what should its `+` be? (I suggest 5×3, with a `+` of 5×4.)
2. **Surge Protection:** make its refund count the whole team's draws (only this card changes)?
3. **Dazed in Nature:** do you want a Nature per-stack Dazed payoff? If yes, that's a deck-pass session for Ratatoskr/Huldra.
4. **Undertow+:** "Draw a card." (no Weakened) or "Draw 2. You gain 1 Weakened."?
5. **Want me to write ticket 167 for the UI items?** It would cover the tooltip beside the mouse (notes 7), the enemy hand panel (4), damage floats (5), rounding Bark Shield (6) and showing patches on the reward screen (12), plus whichever of decisions 1, 2 and 4 you rule on.
