#!/usr/bin/env bash
#
# Configura git para usar los hooks versionados en .githooks/
# (en lugar de .git/hooks, que no se versiona).
#
# Uso:  npm run hooks:install   o   bash scripts/install-git-hooks.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
chmod +x "$ROOT/.githooks/"* 2>/dev/null || true
git config core.hooksPath .githooks

echo "✓ Hooks de git activados (core.hooksPath=.githooks)."
echo "  - prepare-commit-msg: pre-rellena el mensaje según los archivos en stage."
