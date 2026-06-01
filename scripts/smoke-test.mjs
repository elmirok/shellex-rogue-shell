import { SYMBOLS, THEME_PRESETS, knownSymbolsOnly } from "../src/core/symbols.js";
import { abilityModifier, attackRoll, heroRulesStats, rollFormula } from "../src/core/rules.js";
import { validateRoomFlavor } from "../src/ai/schemas.js";

const failures = [];
if (SYMBOLS.player.glyph !== "@") failures.push("player symbol must be @");
if (!THEME_PRESETS.stone_dungeon.monsters.length) failures.push("theme presets must define monsters");
if (knownSymbolsOnly(["@", "nope"]).join("") !== "@") failures.push("known symbol filter failed");
if (abilityModifier(10) !== 0 || abilityModifier(18) !== 4) failures.push("ability modifier math failed");

const rng = fixedRng([0.95, 0.5, 0.4, 0.1]);
const hero = heroRulesStats({ level: 1, abilities: { str: 14, dex: 12, con: 13, int: 10, wis: 11, cha: 10 } }, []);
const attack = attackRoll(rng, hero, 12);
if (!attack.hit) failures.push("expected seeded attack to hit");
const damage = rollFormula(fixedRng([0.5]), "1d6+2");
if (damage.total !== 6) failures.push("damage formula failed");

const flavor = validateRoomFlavor({ room_name: "x", description: "y", suggested_symbols: ["@", "bad"] }, {
  room_name: "fallback",
  description: "fallback",
  tone: "grim",
  theme: "stone_dungeon",
  suggested_symbols: [],
  danger_hint: "careful",
  music: { mood: "low", tempo: 80, scale: "minor", density: 0.4, layers: ["drone"] }
});
if (flavor.suggested_symbols.length !== 1) failures.push("room flavor validator failed");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Smoke tests passed.");

function fixedRng(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

