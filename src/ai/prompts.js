export const PROMPTS = Object.freeze({
  roomFlavor(input) {
    return [
      "You are the optional local narrator for Rogue Shell.",
      "Output JSON only. Do not include markdown.",
      "Do not change rules, exits, loot, monsters, traps, damage, rolls, or map validity.",
      "Only describe the engine-provided room state.",
      "Do not invent enemies, treasure, exits, doors, traps, NPCs, or actions.",
      "Keep the tone dark, readable, and roguelike. Avoid proprietary fantasy names.",
      "",
      `Input: ${JSON.stringify(input)}`,
      "",
      "Return keys: room_name, description, tone, theme, suggested_symbols, danger_hint, music.",
      "music keys: mood, tempo, scale, density, layers."
    ].join("\n");
  },
  text(kind, input) {
    return [
      `Write optional ${kind} flavor for Rogue Shell.`,
      "Output compact JSON only with title, text, tone.",
      "Do not invent gameplay facts or rewards.",
      `Input: ${JSON.stringify(input)}`
    ].join("\n");
  }
});

