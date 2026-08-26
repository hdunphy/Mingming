# Prototype: card frame rework (text-first cards that look shipped) (ticket 66)

- Type: wayfinder:prototype
- Status: open
- Assignee: 
- Blocked by: [32](32-art-direction.md)
- Phase: Content Complete (feeds [34](34-ui-art-pass.md))

## Question

Ticket 32 ruled cards stay TEXT-FIRST — so the frame does all the visual work. Today `ProgramCard.tsx` is name/cost/description/keyword chips + an element glyph. Prototype frames that make 216 art-less cards read as designed, not unfinished: element-colored frame treatments (Neon Industrial: circuit borders, firmware-chrome), cost + energy pips prominent, rarity treatment (common/rare Macros too), keyword chips vs inline bolding, STAB indicator by caster, readable at hand-scale on 1280×800 AND at editor-scale (tickets 62/63 reuse the frame), and the true-damage preview's placement (power dies at the surface — previews show real numbers). Open for Henry: how loud the element color runs (full frame wash vs edge accent); serif/mono/display type direction; whether the signature/payoff card of each engine gets a visually distinct frame.

## Deliverable

One HTML sheet showing the same 4–6 real cards (a 0e generic, a 1e attack, a 2e payoff, a daemon, a Macro) in 2–3 frame directions side by side, light on gimmicks, checked at both scales; Henry picks; the chosen direction becomes ticket 34's card-frame spec.

## Resolution

_(open)_
