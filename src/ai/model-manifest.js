export const AI_MODES = Object.freeze({
  classic: {
    label: "Classic Mode",
    description: "No AI needed. Deterministic dungeon, templates, voice optional.",
    adapter: "template",
    minRam: "4GB recommended",
    storage: "No model storage"
  },
  lite: {
    label: "AI Lite",
    description: "Small local narrator profile. Optional WebGPU/WebLLM path.",
    adapter: "webllm",
    modelId: "Qwen3-0.6B-q4f16_0-MLC",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_0-MLC",
    minRam: "8GB recommended",
    storage: "2-3GB recommended"
  },
  dungeon_master: {
    label: "AI Dungeon Master",
    description: "Richer local storytelling profile. Opt-in only.",
    adapter: "webllm",
    modelId: "Qwen3-1.7B-q4f16_0-MLC",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_0-MLC",
    minRam: "16GB recommended",
    storage: "4-6GB recommended"
  },
  high_quality: {
    label: "High Quality Local",
    description: "Strong-computer profile for future local model packs.",
    adapter: "webllm",
    modelId: "Qwen3-4B-q4f16_0-MLC",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_0-MLC",
    minRam: "24-32GB recommended",
    storage: "8-12GB recommended"
  }
});

export function modelProfile(mode) {
  return AI_MODES[mode] || AI_MODES.classic;
}

