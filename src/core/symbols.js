export const SYMBOLS = Object.freeze({
  player: { glyph: "@", label: "hero", layer: "actor", blocks: false },
  wall: { glyph: "#", label: "wall", layer: "terrain", blocks: true },
  floor: { glyph: ".", label: "floor", layer: "terrain", blocks: false },
  closedDoor: { glyph: "+", label: "closed door", layer: "terrain", blocks: true },
  openDoor: { glyph: "/", label: "open door", layer: "terrain", blocks: false },
  stairsUp: { glyph: "<", label: "stairs up", layer: "terrain", blocks: false },
  stairsDown: { glyph: ">", label: "stairs down", layer: "terrain", blocks: false },
  trap: { glyph: "^", label: "trap", layer: "feature", blocks: false },
  potion: { glyph: "!", label: "potion", layer: "item", blocks: false },
  scroll: { glyph: "?", label: "scroll", layer: "item", blocks: false },
  gold: { glyph: "$", label: "gold", layer: "item", blocks: false },
  crystal: { glyph: "*", label: "crystal", layer: "item", blocks: false },
  weapon: { glyph: ")", label: "weapon", layer: "item", blocks: false },
  armor: { glyph: "[", label: "armor", layer: "item", blocks: false },
  shield: { glyph: "]", label: "shield", layer: "item", blocks: false },
  ring: { glyph: "=", label: "ring", layer: "item", blocks: false },
  amulet: { glyph: "\"", label: "amulet", layer: "item", blocks: false },
  food: { glyph: "%", label: "food", layer: "item", blocks: false },
  liquid: { glyph: "~", label: "liquid", layer: "terrain", blocks: false },
  shrine: { glyph: "_", label: "shrine", layer: "feature", blocks: false },
  demon: { glyph: "&", label: "major evil", layer: "actor", blocks: true },
  dragon: { glyph: "D", label: "dragon", layer: "actor", blocks: true },
  lich: { glyph: "L", label: "lich", layer: "actor", blocks: true },
  zombie: { glyph: "Z", label: "zombie", layer: "actor", blocks: true },
  brute: { glyph: "O", label: "brute", layer: "actor", blocks: true },
  raider: { glyph: "o", label: "raider", layer: "actor", blocks: true },
  miner: { glyph: "g", label: "small raider", layer: "actor", blocks: true },
  rat: { glyph: "r", label: "rat", layer: "actor", blocks: true },
  spider: { glyph: "s", label: "spider", layer: "actor", blocks: true },
  snake: { glyph: "S", label: "snake", layer: "actor", blocks: true },
  troll: { glyph: "T", label: "troll", layer: "actor", blocks: true },
  mummy: { glyph: "M", label: "mummy", layer: "actor", blocks: true },
  vampire: { glyph: "V", label: "vampire", layer: "actor", blocks: true },
  wraith: { glyph: "W", label: "wraith", layer: "actor", blocks: true },
  fungus: { glyph: "F", label: "fungus", layer: "actor", blocks: true },
  bat: { glyph: "B", label: "bat", layer: "actor", blocks: true }
});

export const KNOWN_SYMBOLS = Object.freeze(
  [...new Set(Object.values(SYMBOLS).map((entry) => entry.glyph))]
);

export const THEME_PRESETS = Object.freeze({
  stone_dungeon: {
    terrain: ["#", ".", "+", "/", "<", ">"],
    monsters: ["o", "g", "r", "s", "B"],
    loot: ["!", "?", "$", ")", "[", "]", "\""],
    trapDensity: 0.06,
    music: { mood: "cold stone march", tempo: 78, scale: "dorian", density: 0.42, layers: ["drone", "low pulse"] },
    tone: "ancient, dry, guarded"
  },
  flooded_crypt: {
    terrain: ["#", ".", "~", "+", "/", "<", ">", "_"],
    monsters: ["Z", "M", "W", "s", "S"],
    loot: ["!", "?", "$", "\"", "="],
    trapDensity: 0.08,
    music: { mood: "drowned hymn", tempo: 64, scale: "phrygian", density: 0.35, layers: ["water ticks", "soft choir"] },
    tone: "wet, reverent, mournful"
  },
  goblin_mine: {
    terrain: ["#", ".", "+", "/", "<", ">", "^"],
    monsters: ["g", "o", "r", "s", "B"],
    loot: ["$", ")", "[", "!", "*"],
    trapDensity: 0.13,
    music: { mood: "clattering mine", tempo: 104, scale: "minor", density: 0.62, layers: ["percussion", "metal taps"] },
    tone: "cramped, loud, smoky"
  },
  demon_temple: {
    terrain: ["#", ".", "+", "/", "<", ">", "_", "^"],
    monsters: ["&", "W", "V", "O", "S"],
    loot: ["?", "*", "=", "\"", "!"],
    trapDensity: 0.12,
    music: { mood: "infernal rite", tempo: 92, scale: "harmonic minor", density: 0.7, layers: ["drone", "bells", "pulse"] },
    tone: "hot, ceremonial, hostile"
  },
  dragon_vault: {
    terrain: ["#", ".", "+", "/", "<", ">", "^"],
    monsters: ["D", "O", "T", "B", "s"],
    loot: ["$", "*", ")", "[", "]", "="],
    trapDensity: 0.1,
    music: { mood: "gold and thunder", tempo: 88, scale: "minor pentatonic", density: 0.55, layers: ["brass pulse", "deep drum"] },
    tone: "grand, glittering, dangerous"
  },
  necromancer_crypt: {
    terrain: ["#", ".", "+", "/", "<", ">", "_", "^"],
    monsters: ["L", "Z", "M", "W", "V"],
    loot: ["?", "\"", "=", "!", "%"],
    trapDensity: 0.09,
    music: { mood: "bone arithmetic", tempo: 72, scale: "locrian", density: 0.48, layers: ["dry clicks", "grave drone"] },
    tone: "scholarly, dead, precise"
  },
  fungal_cave: {
    terrain: ["#", ".", "~", "<", ">", "^"],
    monsters: ["F", "s", "S", "r", "B"],
    loot: ["!", "%", "*", "?"],
    trapDensity: 0.07,
    music: { mood: "spore hush", tempo: 69, scale: "whole tone", density: 0.34, layers: ["soft pulse", "air hiss"] },
    tone: "soft, damp, luminous"
  },
  rat_sewer: {
    terrain: ["#", ".", "~", "+", "/", "<", ">", "^"],
    monsters: ["r", "S", "s", "Z", "B"],
    loot: ["!", "$", "%", "?"],
    trapDensity: 0.05,
    music: { mood: "sewer pulse", tempo: 96, scale: "minor", density: 0.5, layers: ["water drip", "pipe knock"] },
    tone: "narrow, sour, restless"
  },
  crystal_cavern: {
    terrain: ["#", ".", "~", "<", ">", "^"],
    monsters: ["s", "S", "F", "W", "B"],
    loot: ["*", "=", "\"", "?", "$"],
    trapDensity: 0.08,
    music: { mood: "glass resonance", tempo: 82, scale: "lydian", density: 0.45, layers: ["chimes", "thin drone"] },
    tone: "bright, brittle, echoing"
  },
  wizard_lab: {
    terrain: ["#", ".", "+", "/", "<", ">", "_", "^"],
    monsters: ["L", "F", "B", "W", "g"],
    loot: ["?", "!", ")", "=", "\"", "*"],
    trapDensity: 0.11,
    music: { mood: "unstable apparatus", tempo: 110, scale: "chromatic", density: 0.68, layers: ["ticks", "sparks", "hum"] },
    tone: "clever, unstable, arcane"
  }
});

export function themePreset(name) {
  return THEME_PRESETS[name] || THEME_PRESETS.stone_dungeon;
}

export function inferThemePreset(prompt = "") {
  const text = prompt.toLowerCase();
  if (hasWord(text, ["water", "flood", "flooded", "crypt"])) return "flooded_crypt";
  if (hasWord(text, ["goblin", "mine", "mines"])) return "goblin_mine";
  if (hasWord(text, ["demon", "temple"])) return "demon_temple";
  if (hasWord(text, ["dragon", "gold"])) return "dragon_vault";
  if (hasWord(text, ["lich", "necromancer"])) return "necromancer_crypt";
  if (hasWord(text, ["fungus", "fungal", "mushroom", "spore"])) return "fungal_cave";
  if (hasWord(text, ["rat", "sewer"])) return "rat_sewer";
  if (hasWord(text, ["crystal", "glass", "moon", "star", "space", "orbit"])) return "crystal_cavern";
  if (hasWord(text, ["wizard", "lab"])) return "wizard_lab";
  return "stone_dungeon";
}

export function itemSymbol(item = {}) {
  if (item.kind === "heal") return SYMBOLS.potion.glyph;
  if (item.kind === "scroll") return SYMBOLS.scroll.glyph;
  if (item.kind === "gold") return SYMBOLS.gold.glyph;
  if (item.slot === "weapon") return SYMBOLS.weapon.glyph;
  if (item.slot === "armor") return SYMBOLS.armor.glyph;
  if (item.slot === "shield") return SYMBOLS.shield.glyph;
  if (item.slot === "ring") return SYMBOLS.ring.glyph;
  if (item.slot === "charm") return SYMBOLS.amulet.glyph;
  return SYMBOLS.crystal.glyph;
}

export function monsterSymbol(name = "", presetName = "stone_dungeon", index = 0) {
  const symbols = themePreset(presetName).monsters;
  const text = name.toLowerCase();
  if (text.includes("dragon")) return SYMBOLS.dragon.glyph;
  if (text.includes("lich")) return SYMBOLS.lich.glyph;
  if (text.includes("zombie") || text.includes("husk")) return SYMBOLS.zombie.glyph;
  if (text.includes("rat")) return SYMBOLS.rat.glyph;
  if (text.includes("spider")) return SYMBOLS.spider.glyph;
  if (text.includes("snake")) return SYMBOLS.snake.glyph;
  if (text.includes("troll")) return SYMBOLS.troll.glyph;
  if (text.includes("mummy")) return SYMBOLS.mummy.glyph;
  if (text.includes("vampire")) return SYMBOLS.vampire.glyph;
  if (text.includes("wraith") || text.includes("ghost")) return SYMBOLS.wraith.glyph;
  if (text.includes("fung")) return SYMBOLS.fungus.glyph;
  if (text.includes("bat")) return SYMBOLS.bat.glyph;
  if (text.includes("demon")) return SYMBOLS.demon.glyph;
  return symbols[index % symbols.length] || SYMBOLS.raider.glyph;
}

export function knownSymbolsOnly(values) {
  return (Array.isArray(values) ? values : []).filter((value) => KNOWN_SYMBOLS.includes(value));
}

function hasWord(text, words) {
  return words.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
}
