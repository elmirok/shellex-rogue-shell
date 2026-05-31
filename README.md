# Rogue Shell

Rogue Shell is a Shellex OS roguelike POC.

The game is packaged as a vault-installable Shellex `.sapp` webapp. A player enters a story prompt, then the game builds a run from generated story, quest, floor, enemy and item chunks. Generated chunks are cached in the Shellex vault so movement stays instant and the content engine is only asked for new material at deliberate boundaries.

## Shellex Install

Rogue Shell exposes the package file Shellex Limax expects:

```txt
https://github.com/elmirok/shellex-rogue-shell/package.sapp.json
```

From Shellex Shell:

```txt
limax repo add https://github.com/elmirok/shellex-rogue-shell RogueShell
limax install RogueShell
rogueshell
```

For local testing, use Shellex `install-app` and choose `package.sapp.json`.

## POC Scope

- Static Shellex webapp runtime: HTML, CSS and browser JavaScript.
- Root `package.sapp.json` generated from source files.
- Scoped vault storage at `/appdata/games.rogue-shell.local`.
- Playable turn-based dungeon map with keyboard and button movement.
- Story prompt, generated story bible, generated floors, generated quests, items and enemies.
- Fixed viewport game surface with intro screen, always-visible run log and animated tiles.
- Seed-generated adaptive WebAudio music and action sound effects.
- Save button plus autosave to the appdata folder in the Shellex vault.
- Pack inventory with usable tonics, equippable gear, XP, levels and hero attributes.
- Interact action for map landmarks marked with `?`.
- Lazy content director: story on new run, floor chunks on stairs, beats on request.
- Browser Qwen adapter is explicit and lazy; it never loads at app boot.
- Procedural fallback keeps the POC playable when browser model loading is unavailable.

## Build

```bash
npm run package
```

This writes and validates `package.sapp.json`.

## Browser Model Note

The intended local model path is Qwen 0.5B in the browser. For the POC, Browser Qwen is behind the **Warm Qwen** action and uses Transformers.js with `Mozilla/Qwen2.5-0.5B-Instruct` when WebGPU is available. If it cannot load, Rogue Shell falls back to the compact pocket generator and keeps running.

See [docs/architecture.md](docs/architecture.md) for the full content-generation plan.
