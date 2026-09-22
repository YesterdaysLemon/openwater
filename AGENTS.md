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

Declared tools (verify availability in the intended agent):
- node (cli): `node`.
- npm (cli): `npm.cmd`.

Edit project guidance outside this managed section. Use `al-stack configure` for its fields and `al-stack check .` for setup checks. Run the actual project checks for behavioral validation.
<!-- al-stack:project:end -->

## Product and acceptance

Openwater is an independently authored Three.js ocean study inspired by Dan Greenheck's Water Pro V3 launch video. The activity opens immediately onto the ocean. Keep the water, ship, island, weather, and camera interaction central; keep interface chrome quiet. Do not describe the directional wave approximation as FFT simulation or claim equivalence with the commercial reference.

Architecture: Vite and plain JavaScript, Three.js WebGLRenderer, a custom Gerstner water shader on Three.js's MIT-licensed Water reflection pass, procedural scene geometry, and a self-hosted CC0 sky. `src/state.js` is the shared source for wave parameters and URL validation. `server.mjs` serves the built static app and exact-release health metadata.

Before release: `npm run check`, `npm test`, `npm run build`; browser-check desktop and 390px mobile, all weather and view presets, controls, pause, ripple, sharing, sound, and error-free shader compilation. Check visual output rather than accepting a successful build as rendering evidence. Respect reduced motion and suspend animation when hidden.

Use global `frontend-quality` and `playwright` skills for interface work, `vps-operations` for delivery, and `credentials-access` if authentication is needed. Deployment goes through the existing Deploy Manager; the app uses openwater.alirezaafshan.com. Public source and this initial deployment are authorized by the creation request; subsequent unrelated publication follows its own request.

Third-party asset provenance lives in `public/assets/README.md`. Reference footage remains excluded from Git and deployment. Never add paid Water Pro assets or code without a supplied license.
