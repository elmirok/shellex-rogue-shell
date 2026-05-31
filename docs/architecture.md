# Rogue Shell Architecture

Status: POC plus design baseline  
Target runtime: Shellex OS iframe webapp  
Repository package contract: root `package.sapp.json`

## Shellex Fit

Shellex apps are static browser app packages stored inside the encrypted vault. Rogue Shell follows that contract:

- `manifest.json` declares a `webapp` with `iframe` runtime.
- `package.sapp.json` contains the manifest and app files.
- Runtime state is written only under `/appdata/games.rogue-shell.local`.
- The app uses the Shellex SDK bridge for `fs.readFile`, `fs.writeFile` and `ui.notify`.
- The package does not require a server, build system, native binary or broad vault permissions.

## Product Shape

Rogue Shell is a prompt-driven roguelike:

1. The player enters the kind of story they want.
2. The content director creates a small story bible.
3. The game creates the first playable dungeon floor.
4. New content is generated only at controlled boundaries.
5. Generated chunks are cached in the vault save.

The design goal is not to ask the model every turn. Movement, combat and map rendering are deterministic local game logic. The model is a director that creates compact content packets.

## POC Content Loop

The POC has these model-trigger points:

- New run: generate `storyBible`.
- Stairs: generate the next floor metadata, then local code builds valid map geometry.
- New Beat: generate a small event beat.

Everything is cached in the save file:

```txt
/appdata/games.rogue-shell.local/save.json
```

If the same floor is revisited or the save is loaded, Rogue Shell reuses cached chunks and does not call the model again.

## Content Chunk Schemas

Story bible:

```json
{
  "title": "string",
  "premise": "string",
  "finalGoal": "string",
  "biomes": ["string"],
  "factions": ["string"],
  "enemies": ["string"],
  "items": ["string"],
  "quest": {
    "title": "string",
    "description": "string",
    "target": "relic | defeat"
  }
}
```

Floor metadata:

```json
{
  "name": "string",
  "mood": "string",
  "objective": "string",
  "enemyNames": ["string"],
  "itemNames": ["string"],
  "landmarkNames": ["string"]
}
```

Event beat:

```json
{
  "title": "string",
  "text": "string",
  "reward": "string"
}
```

The game validates and normalizes every generated object. Map topology is still built locally so the game never accepts invalid model geometry as the source of truth.

## Qwen Strategy

The requested model family is Qwen 0.5B. The browser-first path is:

- Use a WebGPU-capable browser runtime where possible.
- Prepare Qwen only from setup, before a run starts.
- Keep one model instance for the app session.
- Request small JSON chunks with strict prompts.
- Cap prompt size and output size per content type.
- Fall back immediately when model loading, generation or JSON parsing fails.

POC adapter:

```txt
Transformers.js
Mozilla/Qwen2.5-0.5B-Instruct
device: webgpu
dtype: q4f16
```

Important Shellex constraint: iframe apps run sandboxed. Some browser model runtimes may need storage, workers or WebGPU behavior that depends on browser support and iframe policy. The POC therefore treats Browser Qwen as optional until Shellex has a dedicated model runtime or worker capability.

## Performance Budget

Hard rules for the content engine:

- No model call during movement, combat, render or enemy turns.
- Only one generation request may run at a time.
- Story prompt is trimmed to 1200 characters in the POC.
- Response budgets stay under 520 new tokens for story, 380 for floor metadata and 260 for beats.
- Generated maps are small: 23 x 15 tiles.
- Save data is plain JSON and scoped to one appdata folder.
- Local deterministic fallback must always be available.
- Audio is generated locally with WebAudio from the run seed and story state. It does not stream or store audio files.

Future production budgets:

- Add a queue with cancellation and visible progress.
- Store content chunks separately instead of one save file once SVFS folder mode exists.
- Add chunk hashes so duplicate model requests can be reused across runs.
- Add a model capability probe before offering Browser Qwen.
- Add a low-memory mode that disables browser model loading.

## Engine Modules

Current POC modules live in `src/app.js`:

- `ContentDirector`: owns generation triggers and cache checks.
- `BrowserQwenProvider`: lazy browser model adapter.
- Procedural director functions: deterministic fallback content.
- Dungeon engine: local map, turn, combat, item, quest and stair logic.
- `AdaptiveComposer`: seed-driven WebAudio score and short action sounds.
- Inventory model: consumables, equipment slots, stat bonuses, XP thresholds and level-up growth.
- Vault persistence: Shellex SDK save/load wrapper.

Future split:

```txt
src/
  app.js
  engine/
    dungeon.js
    combat.js
    state.js
  generation/
    director.js
    schemas.js
    providers/
      qwen-browser.js
      procedural.js
  shellex/
    sdk.js
    vault-store.js
```

The POC intentionally stays single-file because Shellex MVP packages are plain static files and do not compile modules inside the vault.

## Vault Layout

Current:

```txt
/appdata/games.rogue-shell.local/save.json
```

Planned:

```txt
/appdata/games.rogue-shell.local/
  profile.json
  runs/
    active.json
    run-<id>.json
  chunks/
    story-<hash>.json
    floor-<hash>-001.json
    beat-<hash>-0001.json
  settings.json
```

The planned layout makes it easier to compact old runs, reuse chunks and keep model outputs inspectable.

## Milestones

1. POC package: playable game, save/load, cached generated chunks.
2. Real model path hardening: capability probe, better progress, worker experiment.
3. Content quality pass: richer schema, biome rules, item effects, enemy behaviors.
4. Multi-run vault library: save slots, run summaries, export/import.
5. Shellex integration pass: Limax registry entry and app icon.
6. Production architecture: separate modules, tests, chunk migration and model runtime decision.
