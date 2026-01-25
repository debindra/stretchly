# Public Assets

This directory contains static assets that are copied to the `dist` folder during build.

## Logo

Place the **Stretchly logo** (icon + "Stretchly" wordmark) as:
- `logo.png` — Used in the popup and options page header

The logo should be the official Stretchly logo with:
- Teal/light blue-green icon (stylized human figure)
- "Stretchly" wordmark in dark blue-gray
- Black or transparent background

## Icons

Extension toolbar icons are automatically generated from `logo.png` and placed in the `icons/` subdirectory:
- `icon16.png` — 16x16 pixels
- `icon48.png` — 48x48 pixels  
- `icon128.png` — 128x128 pixels

**To regenerate icons** after updating the logo, run:
```bash
./scripts/generate-icons.sh
```

Or manually using macOS `sips`:
```bash
sips -z 16 16 public/logo.png --out public/icons/icon16.png
sips -z 48 48 public/logo.png --out public/icons/icon48.png
sips -z 128 128 public/logo.png --out public/icons/icon128.png
```
