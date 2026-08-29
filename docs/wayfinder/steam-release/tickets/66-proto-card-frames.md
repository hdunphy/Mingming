# Prototype: card frame rework (text-first cards that look shipped) (ticket 66)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session)
- Blocked by: [32](32-art-direction.md)
- Phase: Content Complete (feeds [34](34-ui-art-pass.md))

## Question

Ticket 32 ruled cards stay TEXT-FIRST — so the frame does all the visual work. Today `ProgramCard.tsx` is name/cost/description/keyword chips + an element glyph. Prototype frames that make 216 art-less cards read as designed, not unfinished: element-colored frame treatments (Neon Industrial: circuit borders, firmware-chrome), cost + energy pips prominent, rarity treatment (common/rare Macros too), keyword chips vs inline bolding, STAB indicator by caster, readable at hand-scale on 1280×800 AND at editor-scale (tickets 62/63 reuse the frame), and the true-damage preview's placement (power dies at the surface — previews show real numbers). Open for Henry: how loud the element color runs (full frame wash vs edge accent); serif/mono/display type direction; whether the signature/payoff card of each engine gets a visually distinct frame.

## Deliverable

One HTML sheet showing the same 4–6 real cards (a 0e generic, a 1e attack, a 2e payoff, a daemon, a Macro) in 2–3 frame directions side by side, light on gimmicks, checked at both scales; Henry picks; the chosen direction becomes ticket 34's card-frame spec.

## Resolution

Closed 2026-08-26. Comparison sheet (3 directions) and the final reference in [research/66-frames-proto/](../research/66-frames-proto/).

**CHOSEN: Direction 3 — CHASSIS** (Henry; the wayfinder's interim Circuit assumption was corrected same-session). Final reference: [frames_chassis_final.html](../research/66-frames-proto/frames_chassis_final.html) (+PNG). Frame spec for ticket 34's card pass:

- **Stamped-plate frame**: element-tinted plate gradient + element border; **energy PIPS top-left** (cost as capacity — glowing squares, unlit pip for 0e; macros get a round pip).
- **TYPE ICON top-right replaces the text banner**: ▲ ATTACK · ✦ SKILL · ◆ DAEMON · ● MACRO, color-coded, tooltip carries the word.
- **NO STAB text on the card** (the icon change makes room; STAB surfaces in play via the true-number preview and in the editor via filters) and **NO payoff glow** — payoff status is a small tag in editor contexts only. Both amend the ticket-62 F reference (its cost gem, text banners, STAB meta line and payoff-glow borders are superseded by this frame).
- **Descriptions present at BOTH scales** — hand-scale cards (~142×186) keep the full description text; editor/shop scale ~188×246. One component, two sizes.
- Duplicates stack with the gold ×N badge (ticket 62 amendment). Art box is a placeholder gradient until ticket 33.
