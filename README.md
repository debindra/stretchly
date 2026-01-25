# Stretchly

Instant relief for desk workers — in under 2 minutes.

Stretchly is a **Chrome extension** (current focus) with a **React Native mobile app** planned. The project uses a monorepo with shared logic.

## Structure

```
stretchly/
├── packages/
│   ├── shared/              # Shared types, exercises, storage abstraction
│   ├── chrome-extension/    # Chrome extension (popup + options + background)
│   └── mobile/              # React Native app (planned)
├── package.json             # Workspace root
└── README.md
```

- **`@stretchly/shared`**: Types (`Exercise`, `ReliefEntry`, `UserSettings`), exercise data, pain routines, and a `StorageAdapter` interface. No React/DOM. Used by both the extension and (later) the mobile app.

- **`@stretchly/chrome-extension`**: Chrome extension (Manifest V3) with:
  - **Popup**: Quick “Open Stretchly” and link to full app.
  - **Options**: Full app — Relief Now, Library, Relief Stats, Settings, Routine Player. Uses `chrome.storage.local` via the shared storage adapter.
  - **Background**: Service worker (placeholder for future reminders).

- **`packages/mobile`**: React Native app (planned). Will consume `@stretchly/shared` and use platform-specific UI + AsyncStorage.

## Setup

```bash
npm install
```

## Chrome extension

**Build**

```bash
npm run build:extension
```

Output: `packages/chrome-extension/dist/`

**Load in Chrome**

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `packages/chrome-extension/dist`

**Development**

```bash
npm run dev:extension
```

Runs `vite build --watch`. Reload the extension in `chrome://extensions/` after changes.

> **Note:** Run the command alone. Don’t add a `#` comment on the same line (e.g. `# watch build`) or Vite can fail with “Could not resolve entry module #/index.html”.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages |
| `npm run build:shared` | Build `@stretchly/shared` only |
| `npm run build:extension` | Build shared + Chrome extension |
| `npm run dev:extension` | Watch build for extension |

## Logo and icons (exact PNGs)

Use the **original Stretchly logo** and icon PNGs — no conversion.

1. **`packages/chrome-extension/public/logo.png`** — Original logo (teal icon + “Stretchly” wordmark on dark). Save your logo PNG here. Used in popup and options header.
2. **`packages/chrome-extension/public/icons/icon16.png`**, **`icon48.png`**, **`icon128.png`** — Extension toolbar icons. Use the logo mark (icon only) at those sizes, or your own icon PNGs.
