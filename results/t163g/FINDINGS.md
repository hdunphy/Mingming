# 163g — patches ranked by value, and what the scorer cannot see

Measured 2026-09-25. Instruments: `scratch/t163g_patchranks.ts` (the 6×12 table) and
`npm run balance:walk -- --seeds 5` (the take-rate, same shape as 163e's).

---

## 1. The old ranking ranked by construction

`patchTouchCount` counted how many of a firmware's hooks a rider changes at all. 163e measured the
result: **`amplifier ×27` — every patch the walker fitted in sixty runs.**

That is not a tuning accident. Amplifier touches an `amount` field, nearly every hook has one, and
ties broke on declaration order with a strict `>`. Amplifier won before any question of worth.

`fenrir_v1` is the clean case, and it is pinned as a test:

| | touches | scored delta |
|---|---|---|
| amplifier | 2 | 16.20 |
| splitter | 2 | **20.30** |

Equal counts, so declaration order decided it. Four points of a health pool per game apart.

## 2. The new ranking discriminates

| | best on |
|---|---|
| amplifier | **8 of 12** (was 12 of 12) |
| splitter | **4 of 12** |
| repeater / relay / overclock / failsafe | 0 of 12 |

And in the walk, where the elite and gate doors do the ranking:

| | patches fitted, 60 runs |
|---|---|
| 163e (touch count) | `amplifier ×27` |
| 163g (scored delta) | **`amplifier ×21, splitter ×8`** |

## 3. THE FINDING: three riders change something and score exactly zero doing it

| rider | field | touches | moves the score |
|---|---|---|---|
| amplifier | amount | 11/12 | 9/12 |
| splitter | target | 4/12 | **4/12** |
| relay | actor | 4/12 | **0/12** |
| repeater | triggers | 1/12 | **0/12** |
| failsafe | drawback | 1/12 | **0/12** |
| overclock | stacks | 0/12 | 0/12 |

Every zero has a mechanism, and none of them is "the rider is bad":

- **RELAY changes `actor`.** The per-proc payoff is computed from the hook's ACTIONS, and the scorer
  does not read who is acting. Splitter changes `target` and moves the score on the same kind of
  hook, because the scope multipliers do read the target.
  **So 163 §3's own worked example — *"a Relay on a self-only OS scores high and on an ally-reading
  OS scores zero"* — is a sentence this scorer cannot say.** It scores zero either way.
- **REPEATER changes `triggers`** — how often the hook fires. The rate in the delta comes from
  `OS_PROC_RATE`, which is MEASURED by census and keyed by hook id, so the delta holds it fixed by
  construction. Repeater's entire value is invisible to this instrument.
- **FAILSAFE** is 163c's recorded inertness. Noted, not touched, per the ruling.
- **OVERCLOCK** changes what a scaler counts rather than any hook, which the file has always said.

**Decision for Henry: two of the six are unrankable by the metric §3 names, for reasons that live in
the scorer.** Pricing Relay needs the per-proc score to read the actor. Pricing Repeater needs a rate
the census cannot supply for a hook that does not ship. Neither is a patch problem; neither is fixed
here.

`patchTouchCount` therefore stays and is not vestigial: *"found nothing"* and *"changed something the
scorer prices at zero"* are different answers, and only the count tells them apart.

## 4. The gate's two offers

Two different KINDS on all twelve, as ruled. `PatchDefinition.field` is already 163 §4's kind,
carried as data for exactly this, so the second offer is the best patch whose field differs from the
first's. The fallback — next-best of any kind — is currently unreachable (six patches, six distinct
fields) and is written anyway, because "currently" is a fact about the table rather than about the
rule. One offer is not a choice, so the pair is never trimmed to one.

Amplifier stays the shop's stock. The shelf is deliberately not the ranking: the shop is where a
player buys the safe one, the gate is where they are offered the good one.

## 5. The shop price stays at 45

| | shop shelves | taken |
|---|---|---|
| 163e, 5 seeds × 12 | 24 | 4 (17%) |
| 163g, 5 seeds × 12 | 21 | 4 (19%) |

**Unchanged, and it should be**: the shop stocks Amplifier whatever the ranking says, so the ranking
cannot move its take-rate. What gates that shelf is the price, and nothing this row did is evidence
about the price. 45 stands.

## 6. A real import cycle, found the hard way

Ranking needs `debug/balance/powerscale`, and `powerscale → core/Hooks → core/entityHooks →
patchRegistry` closes a loop. ESM tolerated it and handed `powerscale` a half-initialised module, so
`STATUS_MODEL` read `undefined` at module scope and the file threw on load.

**It failed loudly, which was luck.** A cycle resolving to `undefined` inside a function would have
shipped.

The split follows the dependency rather than tidiness: `patchRegistry.ts` is the half `entityHooks`
needs (the six transforms, `getPatch`, the slot count, `patchTouchCount`) and imports nothing that
reaches back; `patchRanking.ts` is the half nothing in the hook path needs, so it can see the scorer.
**Anything that APPLIES a patch imports the first; anything that CHOOSES one imports the second.**

`scoreOS` is now a one-line wrapper over a new `scoreHookList`, which is what lets a patched hook
list be priced at all. Pinned by a test asserting the two agree on all twelve — the whole delta rests
on both sides going through one function.

---

## How to reproduce

```
npx vite-node scratch/t163g_patchranks.ts
npm run balance:walk -- --seeds 5 --label t163g
```
