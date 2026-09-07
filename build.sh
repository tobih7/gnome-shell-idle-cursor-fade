#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v gnome-extensions >/dev/null 2>&1; then
    echo "Error: gnome-extensions is required to build the extension." >&2
    exit 1
fi

cd -- "$project_dir"
mkdir -p build
gnome-extensions pack --force --extra-source=LICENSE --out-dir=build .
printf 'Built: %s/build/hide-cursor-idle-fade@tobi.shell-extension.zip\n' "$project_dir"
