# Rogue Shell Field Manual

## Before The Gate Opens

Rogue Shell is a dungeon game for the Shellex vault. Type a story seed, press Start Run, and the vault builds a dungeon from that seed. You do not need AI to play.

Optional local AI can add room descriptions and lore, but the dungeon is ruled by the engine and the dice.

## The Four Ways To Play

Classic Mode:

- No model download
- No server
- No key
- Fastest and safest mode

AI Lite:

- Optional small local narrator
- Intended for Qwen3-0.6B WebLLM/MLC packs
- Best with WebGPU and 8GB RAM
- Falls back to template narration until a WebLLM model library is configured

AI Dungeon Master:

- Richer optional local narrator
- Intended for Qwen3-1.7B packs
- Best with 16GB RAM

High Quality Local:

- Strong-computer mode
- Intended for Qwen3-4B packs
- Opt in only

## The Sacred Rule

The engine builds the dungeon.

The dice decide the truth.

The local AI gives the world a soul.

AI can describe a monster. It cannot decide that the monster hits you. AI can name a room. It cannot add treasure to it. AI can whisper that a trap feels near. It cannot place the trap.

## Reading The Dungeon

```txt
@  hero
#  wall
.  floor
+  closed door
/  open door
<  stairs up
>  stairs down
^  trap
!  potion
?  scroll
$  gold
*  crystal or magic object
)  weapon
[  armor
]  shield
=  ring or seal
"  amulet or charm
%  corpse or food
~  liquid
_  shrine or altar
&  major evil
D  dragon
L  lich
Z  zombie
o  raider
g  small raider
r  rat
s  spider
S  snake
T  troll
O  brute
M  mummy
V  vampire
W  wraith
F  fungus
B  bat
```

## Movement

Move with the arrow keys, WASD, or vi keys.

```txt
W / K / Up       move north
S / J / Down     move south
A / H / Left     move west
D / L / Right    move east
. or R           rest
E or Enter       interact
```

Walking into a monster attacks it. Walking into a closed door opens it and spends a turn.

## Turns

Each important action spends a turn. After you act, enemies may move or attack. Do not waste turns near teeth.

## Combat

Rogue Shell uses d20-style fantasy combat.

Attack:

```txt
d20 + attack bonus vs Armor Class
```

Damage:

```txt
weapon die + ability and gear bonuses
```

A natural 20 is a critical hit. A natural 1 always fails.

## Hero Abilities

Your hero has six abilities:

```txt
STR  strength
DEX  agility
CON  endurance
INT  reason
WIS  instinct
CHA  presence
```

STR and DEX help attacks. DEX helps Armor Class. CON helps survival. WIS helps awareness-flavored checks.

## Pack And Gear

Open the Pack menu to use or equip items.

- Potions restore HP.
- Weapons improve attacks.
- Armor improves AC.
- Charms and other trinkets improve special bonuses.
- Scrolls can be read for lore.

Equipped items are highlighted in the Pack.

## Experience And Leveling

Defeat monsters and complete quest milestones to gain XP. Leveling improves an ability, raises max HP, and restores you to full HP.

## Shrines And Scrolls

Shrines are shown as `_`. Stand next to one and press Interact.

Scrolls are shown as `?`. Pick them up, then read them from the Pack.

## Traps

Traps use saving throws. A good DEX save may reduce the damage. The dungeon decides where traps are before you enter the room.

## Fog Of War

Unseen space is dark. Seen space fades when you move away. Monsters and items only show clearly when they are in view.

## Music And Voice

Music is procedural WebAudio. In AI Mood Procedural mode, validated room mood can change the tempo, scale and density.

Browser Voice can read important narration aloud. It is off by default.

```txt
V      toggle voice
N      repeat last narration
Space  stop current narration
Esc    stop narration or close menu
```

## Saving The Run

Rogue Shell autosaves in the Shellex vault:

```txt
/appdata/games.rogue-shell.local/save.json
```

Use Settings to export or import a save file, clear generated lore cache, or request persistent browser storage.

## Installing In Shellex

In a fresh vault, install the window manager before launching Rogue Shell:

```txt
limax repo sync
limax install W3
limax install RogueShell
w3
rogueshell
```

If `rogueshell` says there is no window manager installed, install and start `W3`, then run `rogueshell` again.

## Survival Advice

Open doors when you are ready.

Rest before entering a crowded room.

Read the log. It remembers what the eye missed.

If the local AI fails to load, keep playing. The vault does not need it to be dangerous.
