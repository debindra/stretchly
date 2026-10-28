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

Extension icons are generated from the figure mark in `logo.png` (the wordmark is
unreadable at toolbar sizes). The mark is cropped, centered on a transparent square
and resampled into `icons/`:
- `icon16.png`, `icon32.png` — toolbar (1x / 2x)
- `icon48.png` — extensions page
- `icon128.png` — install dialog and Chrome Web Store

**To regenerate icons** after updating the logo, run:
```bash
npm run icons -w @stretchly/chrome-extension
```

For sharper large icons, replace `logo.png` with a higher-resolution export; the
script finds the mark automatically.
