export const ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

export const DEFAULT_ABILITIES = Object.freeze({
  str: 14,
  dex: 12,
  con: 13,
  int: 10,
  wis: 11,
  cha: 10
});

export function abilityModifier(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

export function proficiencyBonus(level = 1) {
  return 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);
}

export function migrateAbilities(player = {}) {
  if (player.abilities && ABILITIES.every((key) => Number.isFinite(player.abilities[key]))) {
    return normalizeAbilities(player.abilities);
  }
  const base = player.base || {};
  return normalizeAbilities({
    str: 10 + (base.might || 2) * 2,
    dex: 10 + (base.focus || 1),
    con: 10 + (base.guard || 1) * 2,
    int: 10 + Math.max(0, (base.focus || 1) - 1),
    wis: 10 + (base.focus || 1),
    cha: 10
  });
}

export function normalizeAbilities(abilities = {}) {
  return Object.fromEntries(ABILITIES.map((key) => [
    key,
    clampAbilityNumber(abilities[key], 3, 20, DEFAULT_ABILITIES[key])
  ]));
}

export function rollDie(rng, sides) {
  return 1 + Math.floor(rng() * sides);
}

export function rollFormula(rng, formula = "1d4") {
  const match = String(formula).trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return { total: 1, rolls: [1], formula };
  const count = Math.min(12, Number(match[1]));
  const sides = Math.min(100, Number(match[2]));
  const bonus = Number(match[3] || 0);
  const rolls = Array.from({ length: count }, () => rollDie(rng, sides));
  return { total: rolls.reduce((sum, value) => sum + value, bonus), rolls, formula };
}

export function d20Roll(rng, mode = "normal") {
  const first = rollDie(rng, 20);
  if (mode !== "advantage" && mode !== "disadvantage") return { d20: first, rolls: [first] };
  const second = rollDie(rng, 20);
  return {
    d20: mode === "advantage" ? Math.max(first, second) : Math.min(first, second),
    rolls: [first, second]
  };
}

export function d20Check(rng, { bonus = 0, dc = 10, mode = "normal" } = {}) {
  const roll = d20Roll(rng, mode);
  const total = roll.d20 + bonus;
  return {
    ...roll,
    bonus,
    total,
    dc,
    success: roll.d20 === 20 || (roll.d20 !== 1 && total >= dc),
    critical: roll.d20 === 20,
    fumble: roll.d20 === 1
  };
}

export function heroRulesStats(player = {}, equipment = []) {
  const abilities = normalizeAbilities(player.abilities || DEFAULT_ABILITIES);
  const level = Math.max(1, player.level || 1);
  const prof = proficiencyBonus(level);
  const bonuses = collectBonuses(equipment);
  const dex = abilityModifier(abilities.dex);
  const str = abilityModifier(abilities.str);
  const con = abilityModifier(abilities.con);
  return {
    abilities,
    modifiers: Object.fromEntries(ABILITIES.map((key) => [key, abilityModifier(abilities[key])])),
    proficiency: prof,
    armorClass: 10 + dex + (bonuses.ac || 0),
    attackBonus: prof + Math.max(str, dex) + (bonuses.attack || 0),
    damageBonus: Math.max(0, str) + (bonuses.damage || 0),
    saveBonus: {
      str,
      dex,
      con,
      int: abilityModifier(abilities.int),
      wis: abilityModifier(abilities.wis),
      cha: abilityModifier(abilities.cha)
    },
    skillBonus: {
      might: str + prof,
      guard: con + prof,
      focus: abilityModifier(abilities.wis) + prof
    }
  };
}

export function attackRoll(rng, attacker, defenderAc, mode = "normal") {
  const check = d20Check(rng, { bonus: attacker.attackBonus || 0, dc: defenderAc, mode });
  return {
    ...check,
    hit: check.success,
    targetAc: defenderAc
  };
}

export function savingThrow(rng, actor, ability, dc, proficient = false, mode = "normal") {
  const abilities = normalizeAbilities(actor.abilities || DEFAULT_ABILITIES);
  const bonus = abilityModifier(abilities[ability]) + (proficient ? proficiencyBonus(actor.level || 1) : 0);
  return d20Check(rng, { bonus, dc, mode });
}

export function skillCheck(rng, actor, ability, dc, proficient = false, mode = "normal") {
  return savingThrow(rng, actor, ability, dc, proficient, mode);
}

function collectBonuses(equipment) {
  const totals = {};
  for (const item of equipment || []) {
    for (const [key, value] of Object.entries(item.bonus || {})) {
      if (key === "guard") totals.ac = (totals.ac || 0) + value;
      if (key === "might") totals.attack = (totals.attack || 0) + value;
      if (key === "focus") totals.damage = (totals.damage || 0) + Math.floor(value / 2);
      totals[key] = (totals[key] || 0) + value;
    }
  }
  return totals;
}

function clampAbilityNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
