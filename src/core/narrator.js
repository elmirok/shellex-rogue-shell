export class BrowserNarrator {
  constructor() {
    this.enabled = false;
    this.rate = 1;
    this.voiceURI = "";
    this.lastText = "";
    this.voices = [];
    this.supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    if (this.supported) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", () => this.refreshVoices());
    }
  }

  configure(settings = {}) {
    this.enabled = Boolean(settings.voiceEnabled);
    this.rate = Number(settings.voiceRate || 1);
    this.voiceURI = settings.voiceURI || "";
    if (!this.enabled) this.stop();
  }

  refreshVoices() {
    this.voices = this.supported ? window.speechSynthesis.getVoices() : [];
    return this.voices;
  }

  speak(text, { force = false } = {}) {
    if (!this.supported || !this.enabled || !text) return;
    if (!force && text.length < 20) return;
    this.lastText = text;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(0.6, Math.min(1.4, this.rate));
    const voice = this.voices.find((candidate) => candidate.voiceURI === this.voiceURI);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  repeat() {
    if (this.lastText) this.speak(this.lastText, { force: true });
  }

  pause() {
    if (this.supported) window.speechSynthesis.pause();
  }

  resume() {
    if (this.supported) window.speechSynthesis.resume();
  }

  stop() {
    if (this.supported) window.speechSynthesis.cancel();
  }
}

