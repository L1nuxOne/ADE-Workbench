# ADE-Workbench

This repository contains the ADE-Workbench project.

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

## Continuous Integration

The project relies on a GitHub Actions workflow to verify changes. Each run performs the following steps:
- `npm run build` – type check and compile the frontend code.
- `npm test` – execute the unit test suite.
- `npm run tauri:check` – ensure the Rust backend compiles cleanly.

Developers should run these commands locally before pushing commits. Aligning local runs with the CI workflow reduces turnaround time and makes failures easier to diagnose.
