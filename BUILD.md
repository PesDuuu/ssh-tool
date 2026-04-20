# SSH Tool — Build & Deploy Guide

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Git** (optional, for cloning)

## Project Structure

```
ssh-tool/
├── main/              # Electron main process (Node.js)
│   ├── main.js        # App entry point, window creation, IPC registration
│   ├── preload.js     # Context bridge API exposed to renderer
│   ├── ipc/           # IPC handlers (SSH, SFTP, connections)
│   └── services/      # SSH, SFTP, crypto, connection store services
├── renderer/          # Vite + React frontend
│   ├── src/           # React components, stores, styles
│   ├── dist/          # Production build output (generated)
│   └── package.json   # Renderer-specific dependencies
├── package.json       # Root: Electron app config, scripts, main-process deps
└── BUILD.md           # This file
```

## Install Dependencies

Install both root (Electron/main process) and renderer (React) dependencies:

```bash
npm install
cd renderer && npm install && cd ..
```

## Development

Start the app in development mode (Vite dev server + Electron):

```bash
npm run dev
```

This runs two processes concurrently:

1. **Vite dev server** on `http://localhost:5173` (hot-reload for renderer)
2. **Electron** main process (waits for Vite to be ready, then launches the window)

DevTools open automatically in detached mode during development.

### Individual Dev Commands

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Start both renderer and Electron       |
| `npm run dev:renderer`| Start only the Vite dev server         |
| `npm run dev:electron`| Start only Electron (needs Vite first) |

## Production Build

### Step 1 — Build the Renderer

Compiles the React app into static files at `renderer/dist/`:

```bash
npm run build:renderer
```

### Step 2 — Package with Electron Builder

Builds the renderer and packages the full Electron app into a distributable:

```bash
npm run build
```

This runs `build:renderer` followed by `electron-builder`, which produces platform-specific installers/executables in the `dist/` folder.

### Electron Builder Configuration

By default, `electron-builder` reads its config from `package.json` under the `"build"` key. If no `"build"` key is present, it uses sensible defaults:

- **App entry**: `main/main.js` (from `"main"` field in `package.json`)
- **App ID**: derived from `"name"` field
- **Output**: `dist/` directory

To customize the build (e.g., app icon, target formats, signing), add a `"build"` section to the root `package.json`:

```json
{
  "build": {
    "appId": "com.yourname.ssh-tool",
    "productName": "SSH Tool",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main/**/*",
      "renderer/dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

## Platform-Specific Builds

Build for a specific platform by passing flags to `electron-builder`:

```bash
# Windows
npx electron-builder --win

# macOS
npx electron-builder --mac

# Linux
npx electron-builder --linux
```

> **Note**: Cross-compilation has limitations. Building for macOS requires a macOS machine. Windows and Linux can often be cross-compiled.

## Linting

Run the project linter:

```bash
npm run lint
```

## Troubleshooting

| Issue | Solution |
| --- | --- |
| `electron` command not found | Run `npm install` in the root directory |
| Vite fails to start on port 5173 | Check if the port is in use; kill the process or change the port in `renderer/vite.config.js` |
| `wait-on` times out | Ensure the Vite dev server starts successfully before Electron |
| Native module rebuild errors | Run `npx electron-rebuild` after installing native dependencies |
| Renderer shows blank screen in production | Verify `renderer/dist/index.html` exists after running `npm run build:renderer` |
