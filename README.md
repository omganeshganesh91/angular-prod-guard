# Angular Prod Guard

A VS Code extension that warns you if a **production build script** is missing in your Angular project's `package.json` — before you `git push`.

## Features

- ✅ Auto-detects missing `--configuration production` script on workspace open
- ✅ Re-checks whenever `package.json` is saved
- ✅ Installs a `pre-push` git hook to warn in terminal before pushing
- ✅ Recommends the exact script based on your existing build command

## How It Works

The extension reads your `package.json` scripts and checks if any script contains `--configuration production`. If missing, it shows a warning with a recommendation like:

```json
"build:prod": "ng build --configuration production"
```

## Manual Check

Open Command Palette (`Ctrl+Shift+P`) and run:
```
Angular Prod Guard: Check Production Build Script
```

## Requirements

- Angular project with `package.json` in workspace root
