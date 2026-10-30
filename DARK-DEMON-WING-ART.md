# SS dark demon wing art study

Static art review: `dark-demon-wing-study.html?v=117`.

## Current artwork

- `assets/dark-demon-wings-ss-v2.png`: generated with the built-in image generation tool using the user's two Slime wing reference images. Blue-black bat membranes, arched leading arms, long downturned outer tips, restrained worn edges. Transparent 1536 × 1024 PNG.
- `assets/dark-demon-wings-ss-v2.prompt.txt`: complete generation prompt and reference roles.
- `assets/dark-demon-wings-ss-v2.local.js`: embedded PNG for direct `file://` compatibility.
- `assets/dark-chain-v1.png` and `.local.js`: previously generated worn iron chain, independently mapped along curved paths anchored to the new wing joints. The chain toggle removes only these ornaments.
- The earlier v1 wing art remains available as a separate asset.

## Review controls and scope

Full composition fits the complete wing pair. Detail view enlarges the artwork to 1.65× and allows pointer dragging; Full composition resets its position. Rendering happens only when loaded, resized, scrolled, or interacted with. This stage is static art review; the official assessment and service worker have not been modified.

## Verification

`node artifacts/check-dark-demon-wing.cjs` passed with local Chrome: embedded file loading, chain visibility, repeatable static rendering, detail drag/reset, no page errors, and 390×844 / 320×568 / 844×390 / 1440×900 layouts. Phone and desktop screenshots were visually inspected. PNG transparency was inspected separately. Actual phone/PWA visual acceptance remains for the user.

Animation study is now available at `dark-demon-wing-motion-study.html?v=118`; see `DARK-DEMON-WING-MOTION.md`. The static study remains available for artwork comparison.
