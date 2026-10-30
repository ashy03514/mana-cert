# Probability groups (v113)

The settings page has three separate groups:

- Muggle: the chance of a muggle result per round.
- Basic elements: shared E–SS rank weights for fire, water, wind, and earth; total 100%.
- Light/dark: independent A/S/SS rank weights; total 100%. Defaults are 60/30/10.

The existing element-selection weights remain unchanged. After selecting an element, the result system uses its group's rank distribution. The selected result remains frozen for the round.

A group is disabled when all its corresponding switches are off. Its weights are retained, and turning any corresponding switch back on restores editing. Reset affects enabled groups only; when every group is disabled, reset is disabled too.

Validation:

- `node tests/probability-settings.cjs`: redistribution and total preservation.
- `node tests/rare-rank-probabilities.cjs`: separate basic/rare distributions, validation, defaults, and forced ranks.
- `node tests/probability-groups-browser.cjs`: mobile settings UI, switch availability, retained values, master switch, reset, and independent formal result selection.
- `node tests/rare-rank-settings-browser.cjs`: real S/SS 100% controls through formal number, rank, wings, and retry.
- `node tests/light-formal-offline-browser.cjs`: v113 service-worker assets and offline light rendering.

Browser checks use desktop Chromium. Installed-device PWA appearance and update behavior still need device acceptance.
