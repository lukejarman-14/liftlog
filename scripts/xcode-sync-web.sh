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

# SRCROOT is .../ios/App; the project root is two levels up.
cd "$SRCROOT/../.."

echo "note: [vector] syncing latest web bundle into iOS…"

if [ "$VF_SKIP_WEB_BUILD" != "1" ]; then
  npm run build
fi
npx cap copy ios

echo "note: [vector] web bundle synced."
