# Rogue Shell Architecture

Status: browser-first d20 roguelike POC  
Target runtime: Shellex iframe webapp and static hosts  
Repository package contract: root `package.sapp.json`

## Repo Inspection

The repository is a static browser app:

- `src/index.html`: Shellex app surface, intro, play view, menu panels and settings.
- `src/style.css`: fixed-viewport game layout, board rendering, log dock and responsive rules.
- `src/app.js`: existing app loop, Shellex bridge, map generation, turns, combat, inventory, audio and save/load.
- `scripts/build-package.mjs`: writes `package.sapp.json` from `src/`.
- `scripts/build-static.mjs`: copies `src/` to `dist/` for static hosting.
- `scripts/check-package.mjs`: validates the Shellex package contract.
- `scripts/smoke-test.mjs`: small module-level tests.

The original app already had a playable loop, Shellex vault save, WebAudio composer, inventory and generated content. The current architecture keeps that loop and adds small modules around it.

## Shellex Fit

Rogue Shell follows the static Shellex app model:

- `manifest.json` declares a `webapp` with `iframe` runtime.
- `package.sapp.json` contains the manifest and all source files.
- Runtime state is scoped to `/appdata/games.rogue-shell.local`.
- Permissions are limited to appdata read/write plus `ui:notify`.
- No backend, server route, Node production runtime, account, telemetry, API key or secret is required.

Limax compatibility depends on updating `manifest.json` and regenerating `package.sapp.json` when the app changes.

## Layering

```txt
UI / Shell
  src/index.html, src/style.css

Game engine truth
  src/app.js
  src/core/rules.js
  src/core/symbols.js

Optional flavor
  src/ai/router.js
  src/ai/adapters.js
  src/ai/schemas.js
  src/ai/prompts.js
  src/core/narrator.js

Storage / packaging
  src/core/storage.js
  scripts/build-package.mjs
  scripts/build-static.mjs
```

## Engine Truth

The deterministic game engine owns all gameplay facts:

- procedural map geometry
- room/corridor validity
- walls, floors, doors, stairs, traps and fog of war
- movement, collision and turn order
- d20 attack rolls, saving throws and damage rolls
- monster stats and death
- loot placement
- inventory, equipment and consumables
- XP, level progression and attribute growth
- save/load/export/import

The AI layer receives a summary of actual engine state. It can describe that state, but it cannot create a fact that changes gameplay.

## d20 Rules

`src/core/rules.js` provides a small generic d20 fantasy rules layer:

- STR, DEX, CON, INT, WIS, CHA
- ability modifiers
- proficiency bonus
- AC
- attack roll: `d20 + attack bonus >= AC`
- damage formulas such as `1d6+2`
- saving throws and skill checks
- advantage/disadvantage support
- deterministic seeded RNG input

Old Might/Guard/Focus equipment bonuses are still accepted as compatibility aliases and are mapped into attack, AC and damage.

## Symbol Grammar

`src/core/symbols.js` centralizes map symbols and theme presets. The main map has one primary meaning per symbol:

```txt
@ hero
# wall
. floor
+ closed door
/ open door
< stairs up
> stairs down
^ trap
! potion
? scroll
$ gold
* crystal or magic object
) weapon
[ armor
] shield
= ring or seal
" amulet or charm
% corpse or food
~ liquid
_ shrine or altar
& major evil
D dragon
L lich
Z zombie
o raider
g small raider
r rat
s spider
S snake
T troll
O brute
M mummy
V vampire
W wraith
F fungus
B bat
```

Theme presets define allowed terrain, monsters, loot, trap density, music mood and description tone:

- `stone_dungeon`
- `flooded_crypt`
- `goblin_mine`
- `demon_temple`
- `dragon_vault`
- `necromancer_crypt`
- `fungal_cave`
- `rat_sewer`
- `crystal_cavern`
- `wizard_lab`

## AI Router

The AI layer is adapter-based:

- `NullAIAdapter`: disabled, returns fallbacks.
- `TemplateAIAdapter`: deterministic flavor, no model.
- `MockAIAdapter`: development mode.
- `WebLLMAIAdapter`: lazy optional WebLLM/MLC path.

`AIRouter` handles:

- settings-based adapter selection
- timeout/failure fallback
- validation
- cache keys by seed, floor, room and actual content hash
- avoiding multiple active large model profiles when settings change

The local AI generation interface is intentionally narrow:

```txt
generateRoomFlavor(input)
generateMonsterBark(input)
generateItemLore(input)
generateScrollText(input)
generateQuestHook(input)
generateMusicMood(input)
summarizeMemory(input)
```

The current POC implements room flavor through the router and keeps the remaining methods as adapter extension points.

## Prompt And Validation

Prompts live in `src/ai/prompts.js` and instruct the local model to:

- output JSON only
- describe only provided room state
- avoid changing game rules
- avoid inventing loot, exits, monsters or traps
- keep output short
- avoid proprietary fantasy names

Validation lives in `src/ai/schemas.js`. Room flavor is constrained to short strings, known symbols and a bounded music mood object.

## Voice

`src/core/narrator.js` wraps browser `SpeechSynthesis`.

Settings:

- Browser Voice on/off
- voice selection when voices are exposed
- speech rate
- stop/repeat controls

Keyboard:

- `V`: toggle voice
- `N`: repeat last narration
- `Space` or `Esc`: stop current narration

Voice never blocks gameplay and is disabled by default.

## Music

The WebAudio composer remains procedural. AI does not generate audio. It can only provide mood instructions:

- tempo
- scale
- density
- layer tags
- mood label

When Music is set to `AI Mood Procedural`, the composer uses validated room flavor music metadata. Otherwise it uses deterministic seed music.

## Storage

The game supports:

- autosave
- Save button
- export active save JSON
- import save JSON
- generated lore cache
- clear AI cache
- storage quota estimate
- persistent storage request where supported

Large model files are not stored in the app bundle. Future model packs should use browser cache, user import or public remote manifests.

## Generation Triggers

Allowed generation triggers:

- entering a new floor/room for the first time
- reading a scroll
- inspecting rare lore
- quest milestone
- death scene

Avoided triggers:

- every movement
- every attack
- every miss
- every small pickup
- repeated visits without state change

## Static Hosting

Static build:

```bash
npm run build:static
```

Cloudflare Pages:

- Build command: `npm run build:static`
- Output directory: `dist`
- No secrets
- No server functions
- No backend AI endpoint

## Test Targets

Current checks:

```bash
node --check src/app.js
npm test
npm run package
npm run build:static
```

Smoke coverage currently checks symbol registry, theme presets, d20 math, combat roll helpers and AI output validation. Browser smoke should verify Classic Mode start, movement, combat, menu overlay, save/export and Settings controls.

## Known Limits

- WebLLM model loading is adapter-ready but remains browser and iframe policy dependent.
- The Qwen AI Lite profiles are selectable today, but real WebLLM loading is intentionally preflight-blocked until a matching `model_lib` URL is added to the model manifest.
- Only room flavor currently uses the AI router.
- Fog of war uses radius visibility, not full shadow-casting.
- Save migration preserves old saves, but older procedural floor content keeps its existing layout until a new run or floor is generated.
