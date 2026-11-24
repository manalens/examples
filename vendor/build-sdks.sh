#!/usr/bin/env bash
# Rebuild the vendored SDK tarballs from source.
#
#   bash vendor/build-sdks.sh [web-sdk-ref] [monorepo-ref]
#
# Needs git access to the two source repositories (both private for now),
# Node.js 20.3 or newer and pnpm. Clones each repository into a temporary
# folder, builds the package, and writes the .tgz file into vendor/.
# After a rebuild, run `pnpm install` (not --frozen-lockfile) in each npm
# example to update its lockfile, and update the commits in vendor/README.md.
#
# TODO: delete this script and vendor/ when the packages are on npm.
set -euo pipefail

WEB_REF="${1:-main}"
MONOREPO_REF="${2:-main}"
VENDOR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet https://github.com/manalens/manalens-js.git "$WORK/web"
git -C "$WORK/web" checkout --quiet "$WEB_REF"
(cd "$WORK/web" && pnpm install --frozen-lockfile && pnpm build && pnpm pack --pack-destination "$VENDOR")
echo "web SDK: $(git -C "$WORK/web" rev-parse HEAD)"

git clone --quiet --filter=blob:none --sparse https://github.com/manalens/manalens.git "$WORK/mono"
git -C "$WORK/mono" sparse-checkout set sdks/node sdks/unity
git -C "$WORK/mono" checkout --quiet "$MONOREPO_REF"
(cd "$WORK/mono/sdks/node" && pnpm install --ignore-workspace && pnpm build && pnpm pack --pack-destination "$VENDOR")
echo "Node SDK: $(git -C "$WORK/mono" rev-parse HEAD)"

# Unity: the package folder as package/ in a .tgz (the npm layout that Unity
# Package Manager reads). No build step.
UNITY_VERSION="$(node -p "require('$WORK/mono/sdks/unity/package.json').version")"
mkdir -p "$WORK/unity"
git -C "$WORK/mono" archive HEAD sdks/unity | tar -x -C "$WORK/unity"
mv "$WORK/unity/sdks/unity" "$WORK/unity/package"
(cd "$WORK/unity" && COPYFILE_DISABLE=1 tar -czf "$VENDOR/dev.manalens.sdk-$UNITY_VERSION.tgz" package)
echo "Unity SDK: $(git -C "$WORK/mono" rev-parse HEAD)"
