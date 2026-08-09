#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
APK_OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/debug"
APK_METADATA="$APK_OUTPUT_DIR/output-metadata.json"
OUTPUT_DIR="$ROOT_DIR/dist/apk"

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

if [[ -z "${ANDROID_HOME:-}" ]]; then
  for android_home_candidate in \
    "${ANDROID_SDK_ROOT:-}" \
    "$ROOT_DIR/.android-sdk" \
    "$HOME/Android/Sdk"; do
    if [[ -n "$android_home_candidate" && -d "$android_home_candidate/platforms/android-36" ]]; then
      export ANDROID_HOME="$android_home_candidate"
      break
    fi
  done
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
if [[ ! -f "$APK_METADATA" ]]; then
  echo "No se encontró la metadata del APK: $APK_METADATA" >&2
  exit 1
fi

VERSION_INFO="$(node -e '
  const fs = require("node:fs")
  const metadata = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
  const apk = metadata.elements?.[0]
  if (!apk || !Number.isInteger(apk.versionCode) || !apk.versionName || !apk.outputFile) {
    throw new Error("La metadata de Gradle no contiene una versión de APK válida.")
  }
  process.stdout.write(`${apk.versionName}\t${apk.versionCode}\t${apk.outputFile}`)
' "$APK_METADATA")"
IFS=$'\t' read -r VERSION_NAME VERSION_CODE APK_FILE <<< "$VERSION_INFO"
SOURCE_APK="$APK_OUTPUT_DIR/$APK_FILE"
SAFE_VERSION_NAME="${VERSION_NAME//[^A-Za-z0-9._-]/-}"
OUTPUT_APK="$OUTPUT_DIR/private-balance-${SAFE_VERSION_NAME}-${VERSION_CODE}-debug.apk"

if [[ ! -f "$SOURCE_APK" ]]; then
  echo "No se encontró el APK generado: $SOURCE_APK" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR/finance-app-debug.apk"
cp "$SOURCE_APK" "$OUTPUT_APK"
APK_SHA256="$(sha256sum "$OUTPUT_APK" | awk '{print $1}')"

echo
echo "APK created successfully:"
echo "  $OUTPUT_APK"
echo "  Version: $VERSION_NAME (code $VERSION_CODE)"
echo "  SHA-256: $APK_SHA256"
echo
echo "Original Gradle output:"
echo "  $SOURCE_APK"
