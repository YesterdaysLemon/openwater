<!-- al-stack:project:start -->
## Al-stack project

Project: Openwater. Profile: web. Status: experimental.

Openwater: an interactive ocean inspired by the Water Pro V3 visual reference, independently built with Three.js.

`al-stack.toml` records this project's setup and dependencies. Work from the checkout selected for the task; other branches/worktrees are optional history. Use `al-stack register .` once when starting work here. Local registration does not change the project's lifecycle.

Project commands:
- dev: `npm run dev`
- build: `npm run build`
- check: `npm run check`
- test: `npm test`

Project skills (load when relevant):
- `rich-embed`: `.agents/skills/rich-embed/SKILL.md`. Claude's copy is mirrored in `.claude/skills`.

Declared tools (verify availability in the intended agent):
- node (cli): `node`.
- npm (cli): `npm.cmd`.

Edit project guidance outside this managed section. Use `al-stack configure` for its fields and `al-stack check .` for setup checks. Run the actual project checks for behavioral validation.
<!-- al-stack:project:end -->

## Product and acceptance

Openwater is an independently authored Three.js ocean study inspired by Dan Greenheck's Water Pro V3 launch video. The activity opens immediately onto the ocean. Keep the water, ship, island, weather, and camera interaction central; keep interface chrome quiet. Do not describe the directional wave approximation as FFT simulation or claim equivalence with the commercial reference.

Architecture: Vite and plain JavaScript, Three.js WebGLRenderer, a custom Gerstner water shader on Three.js's MIT-licensed Water reflection pass, procedural scene geometry, and a self-hosted CC0 sky. `src/state.js` is the shared source for wave parameters and URL validation. `server.mjs` serves the built static app and exact-release health metadata.

Before release: `npm run check`, `npm test`, `npm run build`; browser-check desktop and 390px mobile, all weather and view presets, controls, pause, ripple, sharing, sound, and error-free shader compilation. Check visual output rather than accepting a successful build as rendering evidence. Respect reduced motion and suspend animation when hidden.

Responsive behavior: size the renderer and pointer coordinates from the actual canvas container, with CSS owning its dynamic viewport height. Camera presets use aspect-based distance fitting; resizing must preserve the user's orbit and relative zoom. Keep controls within safe-area insets, scroll the settings panel at short heights, and keep captions in the footer flow. Check iPad portrait/landscape, split view, desktop resize, and a short landscape viewport; include a touch-enabled WebKit pass when available. Do not change water shaders for layout fixes.

Use global `frontend-quality` and `playwright` skills for interface work, `vps-operations` for delivery, and `credentials-access` if authentication is needed. Deployment goes through the existing Deploy Manager; the app uses openwater.alirezaafshan.com. Public source and this initial deployment are authorized by the creation request; subsequent unrelated publication follows its own request.

Third-party asset provenance lives in `public/assets/README.md`. Reference footage remains excluded from Git and deployment. Never add paid Water Pro assets or code without a supplied license.

## Rich embed

`/embed` serves the same built HTML and ocean engine with compact view/weather selectors, pause, and an open-full link that preserves the selected conditions. The normal homepage carries the server-readable Player Card metadata and a real 640 by 480 screenshot at `public/player-preview.png`. Keep the view usable down to a 320 by 240 frame. The production Node server owns route normalization and the embed-only frame-ancestors policy for X/Twitter, the Galaxy homepage, and the portfolio; inspect the actual HTTP response when changing it. Do not add a second copy of the simulation or HTML just to provide the route.

Embed acceptance includes a real sandboxed iframe, touch input, reduced motion, selected-state handoff, no compact controls on the ordinary homepage, and measured suspension of simulation and GPU work offscreen without clearing user pause. Use the global `rich-embed` skill. Card metadata, local iframe playback, deployment, and playback within an X post are separate verification states.
