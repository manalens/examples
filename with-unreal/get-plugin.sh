#!/usr/bin/env bash
# Downloads the Manalens Unreal plugin into Plugins/Manalens.
#
#   ./get-plugin.sh            # the version below
#   ./get-plugin.sh v0.2.0     # another release tag
#
# The plugin source is public (MIT): https://github.com/manalens/manalens-unreal
set -euo pipefail

VERSION="${1:-v0.3.0}"
cd "$(dirname "$0")"
rm -rf Plugins/Manalens
mkdir -p Plugins
curl -fsSL "https://github.com/manalens/manalens-unreal/archive/refs/tags/${VERSION}.tar.gz" \
  | tar -xzf - -C Plugins --strip-components=1 "manalens-unreal-${VERSION#v}/Manalens"
echo "Manalens plugin ${VERSION} is in Plugins/Manalens"
