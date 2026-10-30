# Formal rank lettering

The formal readout uses white live text with a progressively stronger halo,
replacing the generated rank sprite sheet. Rank text is 240% of the numeric
readout font size. E/D/C/B/A/S/SS use 1/2/3/4/6/9/13 staggered star emitters.

`js/rank-lettering.js` samples the reveal clock passed by `drawFireScan`.
Each star appears at a seeded random location, grows and shrinks, and rotates
in place before its next lifetime begins at another location. Positions stay
stable during a lifetime. There are no independent timers or RAF loops.
Pause, page lifecycle and retry follow the existing reveal clock; switching
rank replaces the bounded decorative nodes and the undecided dash clears them.
Reduced-motion preference keeps the lettering and halo but hides stars.

The stars are aria-hidden and do not receive pointer events. White lettering
uses a faint warm key shadow on the light background to retain its silhouette.
The numeric value, rank thresholds and committed result remain unchanged.
The previous PNG stays in assets as source artwork but is neither requested
nor precached. Service-worker cache v130 includes the live lettering module.

Validation:

- `node tests/rank-glow-motion.cjs`: graduated intensity/count, deterministic
  pause, stable lifetime positions, pulse/rotation and new spawn locations.
- `node tests/rank-lettering-browser.cjs`: formal E–SS white text, 2.4x size,
  matching star counts, live scan, 998 S / 999 SS, light/dark backgrounds,
  immutable results, accessibility and local file opening.
- `node tests/rank-lettering-offline-browser.cjs`: HTTP precache/offline text
  and stars, no rank-image requests or dependency, reset cleanup.
- `node artifacts/check-result-type.cjs`: six elements and three viewports,
  no readout/button overlap and completed-result actions.

Version 130 doubles the previous rank text, stars and glow radii. The enlarged
rank is centered in the lower available area; layout reserves room above the
action star using its computed bottom inset, including the device safe area.
