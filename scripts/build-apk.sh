#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
SOURCE_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
OUTPUT_DIR="$ROOT_DIR/dist/apk"
OUTPUT_APK="$OUTPUT_DIR/finance-app-debug.apk"

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" || ! -x "${JAVA_HOME}/bin/javac" ]]; then
  for java_home_candidate in \
    "$ROOT_DIR/.jdk/jdk-21.0.11+10" \
    "/usr/lib/jvm/default-java" \
    "/usr/lib/jvm/java-21-openjdk-amd64"; do
    if [[ -x "$java_home_candidate/bin/java" && -x "$java_home_candidate/bin/javac" ]]; then
      export JAVA_HOME="$java_home_candidate"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" || ! -x "${JAVA_HOME}/bin/javac" ]]; then
  echo "Java 21 no está disponible. Configura JAVA_HOME con un JDK válido." >&2
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"

if [[ -z "${ANDROID_HOME:-}" && -d "$ROOT_DIR/.android-sdk" ]]; then
  export ANDROID_HOME="$ROOT_DIR/.android-sdk"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "Android SDK API 36 no está disponible. Configura ANDROID_HOME con un SDK válido." >&2
  exit 1
fi

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
