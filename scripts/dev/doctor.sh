#!/usr/bin/env bash
set -euo pipefail
echo "== ADE-Workbench Doctor =="
echo "Node: $(node -v 2>/dev/null || echo 'missing')"
echo "npm:  $(npm -v 2>/dev/null || echo 'missing')"
echo "cargo: $(cargo -V 2>/dev/null || echo 'missing (ok for now)')"
echo
echo "Checking Node >= 20..."
node -e "process.exit(parseInt(process.versions.node.split('.')[0],10)>=20?0:1)" \
  && echo "OK" || { echo "Please use Node 20 (nvm use 20)"; exit 1; }
echo
echo "Try (optional): npm install && npm run build && npm test"
