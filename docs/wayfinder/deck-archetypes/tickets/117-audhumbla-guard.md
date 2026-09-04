# Ticket 117 — audhumbla_v2's PRIMORDIAL_MILK guard: `target: SELF` → `source: SELF`

**Status:** SHIPPED 2026-08-26. Henry: *"We need to do that asap. Please implement this fix now."*
Flagged in ticket 112 §2, ruled correct at the time, never implemented until now.

## The bug

`PRIMORDIAL_MILK` reads **"Every heal card Audhumbla *casts* also grants her 3 Regen."**
The guard was `"target": "SELF"`, which per `ConditionValidator` means *"the heal's TARGET is the
owner"* — not *"the owner cast it"*. Two different sentences:

- **At 1v1 they are identical.** She is the only body on her side, so every heal she casts targets
  her and every heal targeting her was cast by her.
- **At 3v3 they are not.** Any ally healing Audhumbla filled her Regen battery, and any heal she cast
  on an ally did not. The card text and the code disagreed, and only at width.

Why it matters beyond correctness: ticket 101 measured that battery on a knife edge — 3 Regen per
heal accumulates, 1 per heal would exactly cancel decay — and `drink_deep` cashes it at 15 power a
stack for 68% of her damage. **A support teammate was a free battery she was never priced for.**

## The change

One word, in `src/engine/data/lib/hooks.json`, hook `aud_v2_milk`:

```
-  "target": "SELF",
+  "source": "SELF",
```

872/872 tests green. **1v1-neutral by construction** — with one body per side the two guards select
the same events — so no 1v1 cell moves and this needs no re-baseline of its own.

## `audhumbla_v1` GENESIS_FIRMWARE is deliberately NOT changed

Ticket 112's table flags v1 with the same `target: SELF` note, but v1 is a different case. Its text
reads **"Whenever healing applied *to* Audhumbla exceeds her maximum HP"** — which is exactly what
`target: SELF` means. The code matches the card. There is no text/code disagreement to fix.

There *is* a separate, live question: at 3v3 an ally can overheal her, so her max-Energy ramp
accelerates with teammates. **That is a balance call, not a correctness one** — the card does what it
says. Changing it to `source: SELF` would make the code contradict its own printed text, so it would
need a text change too, which makes it a design decision rather than a bug fix. Left for Henry.
