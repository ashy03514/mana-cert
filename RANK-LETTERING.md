# Formal rank lettering

The formal readout uses the approved `assets/rank-lettering-concept-v1.png`
for E, D, C, B, A, S and SS. `js/rank-lettering.js` displays regions of the
original transparent sheet; it does not alter or regenerate the artwork.
Letter body heights match the mana readout scale, while SS keeps its natural
two-letter width. Existing result generation and rank thresholds are unchanged.

`drawFireScan` updates the artwork when the displayed rank changes. The text
rank remains available to assistive technology. Until the image has loaded,
or if it fails, the regular text rank remains visible. The undecided dash is
also text. Relative asset URLs support static hosting under a project path.
Service-worker cache v125 includes the module and PNG.

Validation:

- `node tests/rank-lettering-browser.cjs`: actual formal E–SS outcomes,
  count-up synchronization, 998 S / 999 SS, light/dark backgrounds, unchanged
  immutable result, accessible text and local file loading.
- `node tests/rank-lettering-offline-browser.cjs`: HTTP precache, offline
  reload and seven rank sprites; failed-image visible text fallback.
- `node artifacts/check-result-type.cjs`: six elements, three viewports,
  no readout/button overlap, typography and completed-result actions.

Browser screenshots are saved under `artifacts/rank-lettering-*.png`.
