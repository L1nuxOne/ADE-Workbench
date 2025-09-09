# ADE-Workbench

This repository contains the ADE-Workbench project.

## Dev Doctor

Use the development doctor to verify your environment:

```bash
nvm use 20
./scripts/dev/doctor.sh
```

## Bootstrap v0

- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Rust check: `npm run tauri:check`
- CI runs these Node and Rust checks on pushes and pull requests.

## Run a flow (preview-only)

Use the Flows pane in the app to experiment with bundled flows without executing them. Edit the inputs, click **Preview** to resolve the commands, then **Copy** and run them manually in your terminal.

## Repo-local flows in dev

- Place YAML flow files under `ade/flows/` or `kit/flows/`.
- Run `npm run dev` and use the **Reload** button in the Flows pane to pick up changes.
- Production builds only include the bundled `src/flows/` directory.

## Host (optional)

An optional Tauri host bridges the UI with the local repository. To run it locally:

```bash
cargo run --features host --manifest-path src-tauri/Cargo.toml
```

Runs are **dry-run** by default. The host restricts filesystem access to `ade/flows/` and `kit/flows/`, only allows `git`, `gh`, `python3`, and `bash` commands, enforces a ~60s timeout, and caps output at ~200 KB.

### Tauri dev harness

Run the full app (host + UI) in one command:

```bash
npm run tauri:dev
```

This launches Vite and the Tauri host with the safe runner.
Conflict Preview now supports an optional **hunk-level** estimator (checkbox) which may take longer on large refs.

### Host options

* **Tauri host (native GUI):** `npm run tauri:dev` (requires GTK/WebKit dev libs on Linux).
* **HTTP host-lite (no GUI deps):**

  ```
  npm run host:lite   # starts the server on http://127.0.0.1:7345
  npm run dev         # start Vite UI
  ```
  * Set a different port: `ADE_HOST_LITE_PORT=7346 npm run host:lite`
  * Health endpoints: `/healthz` → "ok", `/version` → crate version
  The UI auto-detects the host via `/healthz` and uses it when Tauri isn’t present.
* **Retry:** Use the top-right **Retry** button or switch window focus to trigger a re-check.
* **CORS env (dev):**

  * `ADE_HOST_LITE_PERMISSIVE_CORS=1 npm run host:lite` (temporarily allow any origin)
  * `ADE_HOST_LITE_ORIGINS="http://127.0.0.1:5173,http://wsl.localhost:5173"` (custom allowlist)

### Host Contract & Discovery

The UI discovers the backend by requesting `/.well-known/ade.json` from common base URLs (`http://127.0.0.1:7345`, `http://localhost:7345`, `http://wsl.localhost:7345`) or an explicit `?host=` override. The JSON contains the resolved `base` and capability flags. If the endpoint is missing, the UI falls back to probing `/healthz`.

All host interactions go through a `HostClient` instance exposed via React context. Panes call `client.ensure()` before actions to re-check connectivity and then use `client.run()` or `client.read()`. If the host starts after the UI, clicking any action will immediately work once `ensure()` succeeds.

## Select PRs → Merge Train

- Reload PRs (needs host & `gh`)
- Select several → “Send to Merge Train”
- Go to Flows → Merge Train → Preview/Run (dry-run)

## Workspace & Diff

- Requires host and `git` in PATH.
- Shows staged/unstaged files and diff for selection.
- Handles renames/copies and files with both staged & unstaged changes.
- Read-only; no stage/unstage actions (coming later).

## Conflict Preview (dry-run)

- Select PRs → “Send to Merge Train” (or paste refs), choose base, **Analyze**.
- Shows per-ref file lists, pairwise overlap matrix, and a suggested merge order.
- Export via **Copy CSV** and **Copy order** buttons.
- Note: file-level heuristic; hunk-level conflicts will come in v1.1.

## Continuous Integration

The project relies on a GitHub Actions workflow to verify changes. Each run performs the following steps:

- `npm run build` – type check and compile the frontend code.
- `npm test` – execute the unit test suite.
- `npm run tauri:check` – ensure the Rust backend compiles cleanly.

Developers should run these commands locally before pushing commits. Aligning local runs with the CI workflow reduces turnaround time and makes failures easier to diagnose.
