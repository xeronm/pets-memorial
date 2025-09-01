#!/bin/bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
BUILD_DIR=build
DIST_DIR=dist
ARCHIVE_SUFFIX=$(date +"%s")
ARCHIVE_NAME="$NAME-$VERSION-${ARCHIVE_SUFFIX}.zip"
TARGET_ARCHIVE_NAME="$NAME-$VERSION.zip"

mkdir -p "$DIST_DIR"

cd "$BUILD_DIR"
cp -f ../tests/report.json test-report.json
zip -r "../$DIST_DIR/$ARCHIVE_NAME" .
cd -

NEW_HASH=$(md5sum "$DIST_DIR/$ARCHIVE_NAME" | awk '{print $1}')
if [[ -f "$DIST_DIR/$TARGET_ARCHIVE_NAME" ]]; then
    OLD_HASH=$(md5sum "$DIST_DIR/$TARGET_ARCHIVE_NAME" | awk '{print $1}')
else
    OLD_HASH=""
fi

if [[ "$NEW_HASH" != "$OLD_HASH" ]]; then
    cp -f "$DIST_DIR/$ARCHIVE_NAME" "$DIST_DIR/$TARGET_ARCHIVE_NAME" || true
    echo "Done. \"$TARGET_ARCHIVE_NAME\" was updated, hash: $NEW_HASH."
else
    rm -f "$DIST_DIR/$ARCHIVE_NAME"
    echo "Warning: Archive content did not change. Nothing was updated."
fi