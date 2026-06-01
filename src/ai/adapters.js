import { PROMPTS } from "./prompts.js";
import { validateRoomFlavor, validateTextPayload } from "./schemas.js";

export class NullAIAdapter {
  constructor() {
    this.id = "disabled";
    this.ready = true;
  }

  async generateRoomFlavor(_input, fallback) {
    return fallback;
  }

  async generateText(_kind, _input, fallback) {
    return fallback;
  }
}

export class TemplateAIAdapter extends NullAIAdapter {
  constructor() {
    super();
    this.id = "template";
  }

  async generateRoomFlavor(input, fallback) {
    const symbols = (input.symbolsPresent || []).join(" ");
    const enemies = input.contents?.monsters ? `${input.contents.monsters} hostile shapes` : "no visible enemies";
    return validateRoomFlavor({
      room_name: input.floorName || `${titleCase(input.themeLabel || input.theme)} ${input.floor}-${input.roomId}`,
      description: `The chamber answers in ${symbols || "bare stone"}. ${enemies} hold the silence. ${input.contents?.landmark || "The route is yours to read."}`,
      tone: input.dangerLevel > 4 ? "danger" : "grim",
      theme: input.theme,
      suggested_symbols: input.symbolsPresent || [],
      danger_hint: input.dangerLevel > 4 ? "Every shadow has a number behind it." : "Listen before you spend the next turn.",
      music: input.music
    }, fallback);
  }

  async generateText(kind, input, fallback) {
    return validateTextPayload({
      title: `${titleCase(kind)} Signal`,
      text: input.summary || fallback.text,
      tone: fallback.tone || "grim"
    }, fallback);
  }
}

export class MockAIAdapter extends TemplateAIAdapter {
  constructor() {
    super();
    this.id = "mock";
  }

  async generateRoomFlavor(input, fallback) {
    const flavor = await super.generateRoomFlavor(input, fallback);
    return { ...flavor, description: `[mock local ai] ${flavor.description}` };
  }
}

export class WebLLMAIAdapter extends NullAIAdapter {
  constructor({ profile, timeoutMs = 10000 } = {}) {
    super();
    this.id = "webllm";
    this.profile = profile;
    this.timeoutMs = timeoutMs;
    this.engine = null;
    this.ready = false;
  }

  async warm(progress = () => {}) {
    if (this.ready) return true;
    if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable in this browser.");
    if (!this.profile?.modelId) throw new Error("No WebLLM model profile selected.");
    if (!this.profile?.modelLibUrl && !this.profile?.prebuilt) {
      throw new Error(`${this.profile.label || this.profile.modelId} is not yet wired to a WebLLM model_lib. Template fallback remains active.`);
    }
    progress("Importing WebLLM");
    const webllm = await import("https://esm.run/@mlc-ai/web-llm");
    progress(`Loading ${this.profile.modelId}`);
    const appConfig = this.profile.prebuilt ? undefined : {
      model_list: [{
        model: this.profile.modelUrl,
        model_id: this.profile.modelId,
        model_lib: this.profile.modelLibUrl
      }]
    };
    this.engine = await webllm.CreateMLCEngine(this.profile.modelId, {
      appConfig,
      initProgressCallback: (event) => progress(event?.text || "Loading model")
    });
    this.ready = true;
    return true;
  }

  async generateRoomFlavor(input, fallback) {
    if (!this.ready || !this.engine) return fallback;
    const prompt = PROMPTS.roomFlavor(input);
    const json = await this.generateJson(prompt);
    return validateRoomFlavor(json, fallback);
  }

  async generateText(kind, input, fallback) {
    if (!this.ready || !this.engine) return fallback;
    const json = await this.generateJson(PROMPTS.text(kind, input));
    return validateTextPayload(json, fallback);
  }

  async generateJson(prompt) {
    const completion = await withTimeout(this.engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 420
    }), this.timeoutMs);
    const text = completion?.choices?.[0]?.message?.content || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Local model did not return JSON.");
    return JSON.parse(text.slice(start, end + 1));
  }

  async unload() {
    await this.engine?.unload?.().catch?.(() => {});
    this.engine = null;
    this.ready = false;
  }
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Local AI timed out.")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function titleCase(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 80);
}
