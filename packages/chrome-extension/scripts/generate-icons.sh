#!/bin/bash
# Generate Chrome extension icons from logo.png
# Uses macOS built-in sips command

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$EXTENSION_DIR/public"
ICONS_DIR="$PUBLIC_DIR/icons"
LOGO="$PUBLIC_DIR/logo.png"

if [ ! -f "$LOGO" ]; then
  echo "Error: logo.png not found at $LOGO"
  exit 1
fi

mkdir -p "$ICONS_DIR"

echo "Generating icons from $LOGO..."

# Generate icons at required sizes
sips -z 16 16 "$LOGO" --out "$ICONS_DIR/icon16.png" > /dev/null
sips -z 48 48 "$LOGO" --out "$ICONS_DIR/icon48.png" > /dev/null
sips -z 128 128 "$LOGO" --out "$ICONS_DIR/icon128.png" > /dev/null

echo "✓ Generated icons:"
echo "  - icon16.png (16x16)"
echo "  - icon48.png (48x48)"
echo "  - icon128.png (128x128)"
