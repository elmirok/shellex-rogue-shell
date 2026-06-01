# Rogue Shell

Rogue Shell is a browser-first Shellex roguelike. It is a static webapp package that runs from the Shellex vault, autosaves under its own appdata folder, and can also be hosted from any static host such as Cloudflare Pages.

The design rule is:

```txt
The engine builds the dungeon.
The dice decide the truth.
The local AI gives the world a soul.
```

Gameplay never requires a backend, account, API key, paid inference, database, telemetry, or server-side model. Local AI narration is optional and lazy-loaded.

## Modes

- Classic Mode: no AI model. Procedural dungeon, d20-style combat, templates, WebAudio music, optional browser voice.
- AI Lite: optional local narrator profile, intended for Qwen3-0.6B WebLLM/MLC-compatible packs. 8GB RAM and 2-3GB free storage recommended.
- AI Dungeon Master: optional richer local storytelling profile, intended for Qwen3-1.7B packs. 16GB RAM and 4-6GB free storage recommended.
- High Quality Local: opt-in stronger profile, intended for Qwen3-4B packs on strong desktop hardware. 24-32GB RAM and 8-12GB free storage recommended.

Classic Mode is the default and remains fully playable if WebGPU, model loading, or storage persistence is unavailable.

## Shellex Install

Rogue Shell exposes the package file Limax expects:

```txt
https://github.com/elmirok/shellex-rogue-shell/package.sapp.json
```

From Shellex Shell:

```txt
limax repo add https://github.com/elmirok/shellex-rogue-shell RogueShell
limax install RogueShell
rogueshell
```

For local testing in Shellex, use `install-app` and choose `package.sapp.json`.

## Local Development

Open `src/index.html` directly, or serve the folder with any static server:

```bash
npx http-server src -p 4173
```

Build the Shellex package:

```bash
npm run package
```

Build static hosting files:

```bash
npm run build:static
```

Run smoke tests:

```bash
npm test
```

## Cloudflare Pages

Rogue Shell does not need server routes or environment secrets.

- Build command: `npm run build:static`
- Output directory: `dist`
- Runtime: static files only

Do not place large model files in the app bundle. Local model support is designed for browser cache, user-imported packs, or remote public model manifests.

## Engine Contract

The deterministic engine owns:

- map validity, walls, floors, doors, stairs, traps and fog of war
- movement, collision, turns and death
- d20 attack rolls, damage rolls, saving throws and checks
- monsters, loot placement, XP, levels, inventory and equipment
- save/load, export/import and cache integrity

The AI layer may only generate:

- room descriptions
- monster barks
- item lore
- scroll text
- quest hooks
- music mood instructions
- memory summaries

AI output is validated before use and cannot invent actual exits, loot, traps, monsters, hits, misses or rewards.

## Browser Features

- SpeechSynthesis provides optional browser voice narration.
- WebAudio provides procedural music and sound effects.
- Storage Manager APIs are used when available for quota estimates and persistence requests.
- WebGPU is only probed for optional local AI.

## Save And Storage

Autosave and manual save write to:

```txt
/appdata/games.rogue-shell.local/save.json
```

The in-game Settings panel can export/import the save JSON, clear generated lore cache, and request persistent browser storage when supported.

## Repository Shape

```txt
src/
  index.html
  style.css
  app.js
  ai/
    adapters.js
    model-manifest.js
    prompts.js
    router.js
    schemas.js
  core/
    narrator.js
    rules.js
    storage.js
    symbols.js
scripts/
  build-package.mjs
  build-static.mjs
  check-package.mjs
  smoke-test.mjs
```

See [docs/architecture.md](docs/architecture.md) for the implementation architecture.
