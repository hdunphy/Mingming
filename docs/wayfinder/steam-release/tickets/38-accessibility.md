# Accessibility baseline: focus order, labels, colour, text (ticket 38)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [34](34-ui-art-pass.md), [36](36-settings-screen.md)
- Phase: Content Complete

## Deliverable

7 `aria-*` attributes and zero `role=` in all of `src/ui`. Baseline: keyboard focus order on every screen, labels on cards/units/nodes, element colours checked for colourblind contrast (`contrastText.ts` exists — extend to the palette), text size setting honoured, no information carried by colour alone (elements already have glyphs — keep it that way on the map). Not a WCAG audit; a Steam-player baseline.

## Done when

A keyboard-only full run is possible; an automated axe pass on each screen reports no critical issues.

## Resolution

_(open)_

