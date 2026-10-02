# 183a screenshots: the Slant kit, rendered by the real components

`kit-sheet-1280x800.png` and `kit-sheet-1920x1080.png` are the same page at the two sizes ticket 183 D7 asks for: every kit piece (energy hexagon, element marks and badges, status chips, HP bar with Bark Shield, a plaque composed from the kit, slant panels, readout strips) drawn by the real components and the real stylesheet. Compare with `research/183-mocks/183-kit.html`, which is the same pieces drawn by hand.

To retake them: run `npm run dev`, open `/Mingming/kit.html` (a dev-only page: `kit.html` is not a build input, so it never reaches `dist/`), and capture at 1280x800 and 1920x1080. The page is `src/debug/kitSheet/KitSheet.tsx`.
