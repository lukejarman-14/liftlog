#!/bin/sh
# Rebuilds the web bundle and copies it into the iOS project before Xcode bundles
# resources, so pressing Run/Archive in Xcode always ships the latest web code.
# Wired in as the first "Run Script" build phase of the vectorfootball target.
#
# To skip the slow full rebuild and only re-copy the existing dist/, run Xcode
# with VF_SKIP_WEB_BUILD=1 in the scheme's environment (or comment out the build line).
set -e

# Xcode build phases run with a minimal PATH — add the Homebrew/global node location.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
# Avoid copying Finder/resource-fork metadata into the bundled web assets. Those
# extended attributes make iOS codesigning fail with "detritus not allowed".
export COPYFILE_DISABLE=1

# SRCROOT is .../ios/App; the project root is two levels up.
cd "$SRCROOT/../.."

echo "note: [vector] syncing latest web bundle into iOS…"

if [ "$VF_SKIP_WEB_BUILD" != "1" ]; then
  npm run build
fi
npx cap copy ios

# Capacitor copies the web bundle into App/public. Strip any macOS extended
# attributes that may have come from Finder/download provenance before codesign.
/usr/bin/xattr -cr "$SRCROOT/App/public" 2>/dev/null || true

echo "note: [vector] web bundle synced."
