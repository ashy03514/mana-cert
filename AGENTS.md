# Project instructions

The primary project is `C:\Codex\Mana Cert\mana-cert`, linked to GitHub Desktop.
Do not implement future changes in the former `C:\Codex\mana-cert-main` copy.

## Version number

The user requires a new visible version for every delivered application change.
Before delivering a change, run `node scripts/bump-version.cjs` once to increment
both the version next to the settings update button and the service-worker cache.
Run `node scripts/bump-version.cjs --check` to confirm they match. Keep this rule
for future UI, animation, configuration, asset and runtime changes.

The version badge must be embedded in `index.html`. It identifies the actual
loaded page, including an offline/cached page. Never derive it from the URL query
or fetch the latest server version and display that as the loaded version.

Preserve user modifications. Do not commit or push without user authorization.
