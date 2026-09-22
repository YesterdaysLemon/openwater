# Delivery

- Repository: `YesterdaysLemon/openwater`, branch `main`.
- Public URL: https://openwater.alirezaafshan.com/
- Deploy Manager: https://deploy.alirezaafshan.com/
- App ID: `openwater`; checkout `/opt/openwater/app`, owned by `deploy-manager`.
- Candidate: `127.0.0.1:3221`; production: `127.0.0.1:3220`; container: `8080`.
- Public health and release identity: `/healthz`, `/version.json`.
- Additive registration input: `deploy/fleet.json`.

Use the host-level `vps-operations` skill and the current Deploy Manager `docs/add-app.md` workflow. Do not replace the installed fleet with this one-app input. Plan and review its additive diff before applying, check the release lane before restarting the manager, and validate the complete Caddy configuration before reload.

The Docker build uses Git only in the build stage to stamp `dist/version.json`. The production image includes neither Git history nor credentials, runs as the unprivileged `node` user, and binds through a loopback-only VPS port.

CI validates syntax, state and buoyancy invariants, and the production build before sending a signed deployment request. It polls the returned receipt to a terminal result. `DEPLOY_ENABLED=true` enables deployment for main-branch push/dispatch. Secrets are `DEPLOY_WEBHOOK_URL` and `DEPLOY_WEBHOOK_SECRET`, with the matching root-only VPS variable `OPENWATER_DEPLOY_WEBHOOK_SECRET`.

A failed candidate leaves production in place. If post-swap health fails, Deploy Manager restores the previous image when one exists. The initial deployment has no earlier image. An accepted receipt is not proof of publication: verify the terminal receipt, running SHA-tagged image, public HTTPS identity, and the browser-rendered scene.
