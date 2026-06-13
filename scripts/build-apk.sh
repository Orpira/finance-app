#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
SOURCE_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
OUTPUT_DIR="$ROOT_DIR/dist/apk"
OUTPUT_APK="$OUTPUT_DIR/finance-app-debug.apk"

cd "$ROOT_DIR"

echo "Building web assets..."
npm run build

echo "Syncing Capacitor Android project..."
npx cap sync android

echo "Building Android debug APK..."
cd "$ANDROID_DIR"
./gradlew assembleDebug

cd "$ROOT_DIR"
mkdir -p "$OUTPUT_DIR"
cp "$SOURCE_APK" "$OUTPUT_APK"

echo
echo "APK created successfully:"
echo "  $OUTPUT_APK"
echo
echo "Original Gradle output:"
echo "  $SOURCE_APK"
