import { knownSymbolsOnly } from "../core/symbols.js";

const TONES = new Set(["grim", "mournful", "tense", "wonder", "ritual", "comic", "quiet", "danger"]);
const SCALES = new Set(["minor", "dorian", "phrygian", "lydian", "locrian", "whole tone", "minor pentatonic", "harmonic minor", "chromatic"]);

export function validateRoomFlavor(candidate, fallback) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const music = validateMusicMood(source.music, fallback.music);
  return {
    room_name: limitText(source.room_name, 80, fallback.room_name),
    description: limitText(source.description, 500, fallback.description),
    tone: validateTone(source.tone, fallback.tone),
    theme: limitText(source.theme, 80, fallback.theme),
    suggested_symbols: knownSymbolsOnly(source.suggested_symbols).slice(0, 12),
    danger_hint: limitText(source.danger_hint, 160, fallback.danger_hint),
    music
  };
}

export function validateTextPayload(candidate, fallback) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  return {
    title: limitText(source.title, 80, fallback.title),
    text: limitText(source.text, 500, fallback.text),
    tone: validateTone(source.tone, fallback.tone)
  };
}

export function validateMusicMood(candidate, fallback = {}) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const scale = typeof source.scale === "string" && SCALES.has(source.scale) ? source.scale : fallback.scale || "minor";
  return {
    mood: limitText(source.mood, 80, fallback.mood || "low dungeon pulse"),
    tempo: clampNumber(source.tempo, 40, 160, fallback.tempo || 78),
    scale,
    density: clampNumber(source.density, 0, 1, fallback.density ?? 0.45),
    layers: Array.isArray(source.layers)
      ? source.layers.map((item) => limitText(item, 32, "")).filter(Boolean).slice(0, 5)
      : fallback.layers || ["drone"]
  };
}

export function limitText(value, max, fallback = "") {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

function validateTone(value, fallback = "grim") {
  const tone = limitText(value, 24, fallback).toLowerCase();
  return TONES.has(tone) ? tone : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

