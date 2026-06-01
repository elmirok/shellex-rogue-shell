import { TemplateAIAdapter, MockAIAdapter, NullAIAdapter, WebLLMAIAdapter } from "./adapters.js";
import { validateRoomFlavor } from "./schemas.js";
import { modelProfile } from "./model-manifest.js";

export class AIRouter {
  constructor({ hashString, cacheStore } = {}) {
    this.hashString = hashString || simpleHash;
    this.cacheStore = cacheStore;
    this.adapter = new TemplateAIAdapter();
    this.mode = "classic";
  }

  configure(settings = {}) {
    this.mode = settings.aiMode || "classic";
    if (settings.aiNarrator === "off") {
      this.adapter?.unload?.();
      this.adapter = new NullAIAdapter();
      return;
    }
    if (settings.aiNarrator === "mock") {
      this.adapter?.unload?.();
      this.adapter = new MockAIAdapter();
      return;
    }
    if (settings.aiNarrator === "local") {
      const profile = modelProfile(this.mode);
      if (this.adapter?.id === "webllm" && this.adapter.profile?.modelId === profile.modelId) return;
      this.adapter?.unload?.();
      this.adapter = new WebLLMAIAdapter({ profile });
      return;
    }
    this.adapter?.unload?.();
    this.adapter = new TemplateAIAdapter();
  }

  async warm(progress) {
    if (typeof this.adapter.warm !== "function") return false;
    return this.adapter.warm(progress);
  }

  async generateRoomFlavor(input, fallback) {
    const key = this.cacheKey("room", input);
    const cached = this.cacheStore?.get?.(key);
    if (cached) return validateRoomFlavor(cached, fallback);
    let result = fallback;
    try {
      result = await this.adapter.generateRoomFlavor(input, fallback);
    } catch {
      result = fallback;
    }
    const validated = validateRoomFlavor(result, fallback);
    this.cacheStore?.set?.(key, validated);
    return validated;
  }

  cacheKey(kind, input) {
    const stable = JSON.stringify({
      kind,
      seed: input.seed,
      floor: input.floor,
      roomId: input.roomId,
      theme: input.theme,
      symbols: input.symbolsPresent,
      contents: input.contents,
      dangerLevel: input.dangerLevel
    });
    return `${kind}:${this.hashString(stable)}`;
  }
}

export class MemoryCacheStore {
  constructor(bucket = {}) {
    this.bucket = bucket;
  }

  get(key) {
    return this.bucket[key] || null;
  }

  set(key, value) {
    this.bucket[key] = value;
  }

  clear() {
    for (const key of Object.keys(this.bucket)) delete this.bucket[key];
  }
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
