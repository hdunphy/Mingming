# Playtest & ship criteria — the one page Henry plays by

**Status:** RULED 2026-09-25 (Henry + designer, one session). Answers the two items the map has carried under "Not yet specified" since August: *what does Henry play before something is "in the game"*, and *what does he write down so the next session acts on it without a memory*. The walker (157) owns the numbers; this page owns what only Henry can do.

## 1. The unit of play — RULED

- **Default: a full run, start → gym.** That is what a player meets and it is the only thing that tests picks, benches, patches and the route together.
- **Scenario play is for balancing one thing** — a single gym fight or a single deck at fight one, launched from the scenario launcher. Use it when a deck or a gym is the question; never as the only play in a session.
- **A session = 1–2 picked scenarios + one free run.** The scenarios are assigned (by the designer, from what the walker or the last session flagged); the free run is Henry's choice of party and gym, played as a player would.

## 2. What ends a session early — RULED

Only a **game-breaking bug** (the run cannot continue). Everything else — a visual bug, a wrong number, a card that feels bad, a fight that feels unfair — is played through and written down. The 08-30 and 09-05 pattern stands: seven notes from one sitting beat one note from seven sittings.

## 3. "This deck is in the game" — RULED

A kit is **in** when all three hold: Henry has played it through a full run at least once; its OS procced and he could name what it did from the tell alone (146's bar); and it cleared, or nearly cleared, a gym. Until then it is a draft, however good its walker numbers.

## 4. The note — RULED: never ask what the log already knows

The exported run log (Settings → Playtest → Export) carries every node, pick, skip, buy, sell, upgrade, patch, fight row and the clock. **Nothing on it is asked twice.** What only Henry can answer, one line each, tagged **bug / balance / feel**:

1. **Fight one** — did the opening five read as a weak engine with one payoff, and did the first pick feel like it completed something?
2. **The party** — name one moment the three bodies did something together that one could not have done alone. If there is no moment, say so; that is the note.
3. **The OS** — for each body, could you name what its OS did from the tell alone? (146's bar.)
4. **The picks and the benches** — was there a reward screen where you wanted two things? Was an upgrade or a patch ever a real choice against a card? If you never sold, why not?
5. **The scout** — did the preview change who you recruited or which way you went?
6. **The gym** — did it feel like the run's argument being settled, or like a wall? Did the boss field what the scout showed?
7. **The worst minute** — where did you feel done with the run before it ended?
8. **Play again, 1–5**, and the one thing that would raise it by one.

Bugs get a line each with the screen and the moment; a snapshot export (Ctrl+Shift+E) on any bug that involves the board, since the log does not carry it.

## 5. Where the note goes — RULED

`playtest-results/<date>-<gym>-<party>/` at the repo root, beside the steam-release rounds already there: `notes.md` (the eight answers + the bug lines), the exported run log, any snapshots. The designer turns it into rows the same day and links the folder from the HANDOFF block; the note is the primary source, the ticket is the derivation.

## 6. "This gym is in" — RULED

Henry has **beaten it with its counter party and lost to it with a non-counter party** (the route is doing work), and **the scout's preview matched what the gauntlet fielded.**

## 7. The whole game is shippable — RULED

All of: every one of the twelve kits is *in* (§3); all three gyms are *in* (§6); **events are in the run** (steam-release 30 — the last missing piece); two consecutive free runs produce **zero bug notes**; run length lands in **35–45 minutes**; "play again" is **4 or better on both**. The walker's bands (95/75/60) are a precondition for scheduling a session, not a substitute for one.

## 8. The session card — what the designer hands Henry before each playtest

One or two picked scenarios (a deck at fight one, or a gym with a named party) with the question each is meant to answer, the free run left open, and §4's eight prompts. Tonight's: **Rootfall with a Fire-led party** (fenrir_v2 or sköll_v2 start, recruit the other, third body by the shop and the scout) — the question is whether the counter route works against the strongest gym; scenario: **jormungandr_v1 at fight one** after 157-r3 — the question is whether the new five plays.
