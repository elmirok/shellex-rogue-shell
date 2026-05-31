const APP_ID = "games.rogue-shell.local";
const DATA_DIR = `/appdata/${APP_ID}`;
const SAVE_PATH = `${DATA_DIR}/save.json`;
const DEFAULT_PROMPT = "A broken moon has fallen into an encrypted archive. I am a scavenger trying to reach the root directory before rival ghosts rewrite the world.";

const dom = {
  setup: document.querySelector("[data-setup]"),
  play: document.querySelector("[data-play]"),
  prompt: document.querySelector("[data-story-prompt]"),
  start: document.querySelector("[data-start]"),
  load: document.querySelector("[data-load]"),
  board: document.querySelector("[data-board]"),
  engineStatus: document.querySelector("[data-engine-status]"),
  floorLabel: document.querySelector("[data-floor-label]"),
  placeName: document.querySelector("[data-place-name]"),
  turn: document.querySelector("[data-turn]"),
  hp: document.querySelector("[data-hp]"),
  xp: document.querySelector("[data-xp]"),
  gold: document.querySelector("[data-gold]"),
  questTitle: document.querySelector("[data-quest-title]"),
  questCopy: document.querySelector("[data-quest-copy]"),
  inventory: document.querySelector("[data-inventory]"),
  log: document.querySelector("[data-log]"),
  provider: document.querySelector("[data-provider]"),
  warmQwen: document.querySelector("[data-warm-qwen]"),
  modelNote: document.querySelector("[data-model-note]"),
  rest: document.querySelector("[data-rest]"),
  nextBeat: document.querySelector("[data-next-beat]"),
  musicToggle: document.querySelector("[data-music-toggle]"),
  musicStatus: document.querySelector("[data-music-status]"),
  introLine: document.querySelector("[data-intro-line]")
};

let state = null;
let busy = false;
const fx = {
  tileKey: "",
  tileKind: "",
  revealDepth: 0,
  revealAt: 0,
  boardHitUntil: 0
};

const api = createShellexApi();
let qwen = null;
let director = null;
let composer = null;

function bindUi() {
  dom.start.addEventListener("click", () => startRun());
  dom.load.addEventListener("click", () => loadRun());
  dom.rest.addEventListener("click", () => takeRest());
  dom.nextBeat.addEventListener("click", () => requestStoryBeat());
  dom.warmQwen.addEventListener("click", () => warmQwen());
  dom.musicToggle.addEventListener("click", () => toggleMusic());
  dom.provider.addEventListener("change", () => {
    if (!state) return;
    state.settings.provider = dom.provider.value;
    appendLog(dom.provider.value === "qwen" ? "The director will ask Browser Qwen when it is warm." : "The director returned to the pocket generator.");
    saveRun();
    render();
  });
  document.querySelectorAll("[data-act]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.act;
      if (direction === "up") movePlayer(0, -1);
      if (direction === "down") movePlayer(0, 1);
      if (direction === "left") movePlayer(-1, 0);
      if (direction === "right") movePlayer(1, 0);
    });
  });
  window.addEventListener("keydown", (event) => {
    if (!state || dom.play.hidden) return;
    const key = event.key.toLowerCase();
    const active = document.activeElement;
    const typing = active && ["TEXTAREA", "INPUT", "SELECT"].includes(active.tagName);
    if (typing) return;
    const moves = {
      arrowup: [0, -1],
      w: [0, -1],
      k: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      j: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      h: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
      l: [1, 0]
    };
    if (moves[key]) {
      event.preventDefault();
      movePlayer(moves[key][0], moves[key][1]);
    }
    if (key === "." || key === "r") {
      event.preventDefault();
      takeRest();
    }
  });
}

async function startRun() {
  if (busy) return;
  const storyPrompt = (dom.prompt.value || DEFAULT_PROMPT).trim().slice(0, 1200);
  const seed = hashString(`${storyPrompt}:${Date.now()}`);
  state = {
    schema: "rogue-shell-save-v1",
    appId: APP_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storyPrompt,
    seed,
    turn: 0,
    floor: 1,
    player: {
      x: 1,
      y: 1,
      hp: 24,
      maxHp: 24,
      xp: 0,
      gold: 0
    },
    inventory: [],
    log: [],
    generated: {
      story: null,
      floors: {},
      beats: []
    },
    settings: {
      provider: "procedural",
      qwenModel: "Mozilla/Qwen2.5-0.5B-Instruct",
      musicEnabled: dom.musicToggle.dataset.enabled !== "false"
    },
    currentFloor: null
  };

  showPlay();
  await startMusic();
  await withBusy("Weaving first floor", async () => {
    await director.ensureStory(state);
    composer?.update(state);
    await enterFloor(1);
    appendLog(`${state.generated.story.title} begins.`);
    appendLog(state.generated.story.premise);
  });
  await saveRun();
  render();
  focusBoard();
}

async function loadRun() {
  if (busy) return;
  try {
    const text = await api.fs.readFile(SAVE_PATH);
    const loaded = JSON.parse(text);
    if (loaded?.schema !== "rogue-shell-save-v1") throw new Error("Unknown save format.");
    state = loaded;
    state.settings = {
      provider: "procedural",
      qwenModel: "Mozilla/Qwen2.5-0.5B-Instruct",
      musicEnabled: true,
      ...(state.settings || {})
    };
    state.currentFloor = state.currentFloor || state.generated?.floors?.[String(state.floor)] || null;
    showPlay();
    await startMusic();
    appendLog("Vault save loaded.");
    render();
    focusBoard();
  } catch (error) {
    setEngine("No vault save");
    await api.ui.notify(`Rogue Shell: ${error.message}`);
  }
}

async function saveRun() {
  if (!state) return;
  state.updatedAt = new Date().toISOString();
  try {
    await api.fs.writeFile(SAVE_PATH, JSON.stringify(state, null, 2));
  } catch (error) {
    setEngine(`Save failed: ${error.message}`);
  }
}

function showPlay() {
  dom.setup.hidden = true;
  dom.play.hidden = false;
  dom.introLine.textContent = "run mounted";
}

async function enterFloor(depth) {
  const floor = await director.ensureFloor(state, depth);
  state.floor = depth;
  state.currentFloor = clone(floor);
  state.player.x = state.currentFloor.start.x;
  state.player.y = state.currentFloor.start.y;
  fx.revealDepth = depth;
  fx.revealAt = Date.now();
  if (depth > 1) composer?.sfx("stairs");
  composer?.update(state);
  appendLog(`Descended into ${state.currentFloor.name}.`);
}

async function movePlayer(dx, dy) {
  if (!state || busy) return;
  const floor = state.currentFloor;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!isInside(floor, nx, ny) || tileAt(floor, nx, ny) === "#") {
    markFx("bump", Math.max(0, Math.min(floor.width - 1, nx)), Math.max(0, Math.min(floor.height - 1, ny)));
    composer?.sfx("bump");
    appendLog("Stone, static and old permissions refuse the path.");
    render();
    return;
  }

  const enemy = findEnemy(nx, ny);
  if (enemy) {
    attackEnemy(enemy);
  } else {
    state.player.x = nx;
    state.player.y = ny;
    markFx("step", nx, ny);
    composer?.sfx("move");
    collectItemAt(nx, ny);
    inspectLandmark(nx, ny);
  }

  state.turn += 1;
  await maybeUseStairs();
  if (state.player.hp > 0) enemyTurn();
  checkDefeat();
  await saveRun();
  render();
}

function attackEnemy(enemy) {
  const rng = rngFor(`combat:${state.seed}:${state.turn}:${enemy.id}`);
  const damage = 3 + Math.floor(rng() * 5) + Math.floor(state.player.xp / 12);
  enemy.hp -= damage;
  markFx("hit", enemy.x, enemy.y);
  composer?.sfx("hit");
  appendLog(`You hit ${enemy.name} for ${damage}.`);
  if (enemy.hp <= 0) {
    enemy.dead = true;
    const gold = 2 + Math.floor(rng() * 7) + state.floor;
    state.player.xp += 4 + state.floor;
    state.player.gold += gold;
    appendLog(`${enemy.name} collapses into cache dust. +${gold} gold.`);
    if (state.generated.story.quest.target === "defeat" && livingEnemies().length === 0) {
      completeQuest("The floor is clear. The quest thread tightens.");
    }
  } else {
    const counter = Math.max(1, enemy.atk + Math.floor(rng() * 3) - 1);
    state.player.hp -= counter;
    fx.boardHitUntil = Date.now() + 220;
    appendLog(`${enemy.name} answers for ${counter}.`);
  }
}

function enemyTurn() {
  const floor = state.currentFloor;
  for (const enemy of livingEnemies()) {
    const distance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
    if (distance === 1) {
      state.player.hp -= enemy.atk;
      fx.boardHitUntil = Date.now() + 220;
      appendLog(`${enemy.name} claws at your prompt for ${enemy.atk}.`);
      continue;
    }
    const rng = rngFor(`enemy:${state.seed}:${state.turn}:${enemy.id}`);
    if (distance > 6 || rng() < 0.35) continue;
    const stepX = Math.sign(state.player.x - enemy.x);
    const stepY = Math.sign(state.player.y - enemy.y);
    const options = rng() > 0.5 ? [[stepX, 0], [0, stepY]] : [[0, stepY], [stepX, 0]];
    for (const [dx, dy] of options) {
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;
      if (isWalkableForEnemy(floor, nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        break;
      }
    }
  }
}

function isWalkableForEnemy(floor, x, y) {
  if (!isInside(floor, x, y) || tileAt(floor, x, y) === "#") return false;
  if (state.player.x === x && state.player.y === y) return false;
  return !livingEnemies().some((enemy) => enemy.x === x && enemy.y === y);
}

function collectItemAt(x, y) {
  const item = state.currentFloor.items.find((candidate) => !candidate.taken && candidate.x === x && candidate.y === y);
  if (!item) return;
  item.taken = true;
  if (item.kind === "heal") {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + item.power);
    appendLog(`${item.name} restores ${item.power} HP.`);
  } else {
    state.inventory.push(item.name);
    appendLog(`You pocket ${item.name}.`);
  }
  markFx("pickup", x, y);
  composer?.sfx(item.kind === "heal" ? "heal" : "pickup");
  if (state.generated.story.quest.target === "relic" && item.quest) {
    completeQuest(`${item.name} answers the quest.`);
  }
}

function inspectLandmark(x, y) {
  const landmark = state.currentFloor.landmarks.find((item) => item.x === x && item.y === y);
  if (!landmark || landmark.seen) return;
  landmark.seen = true;
  appendLog(`${landmark.name}: ${landmark.text}`);
}

async function maybeUseStairs() {
  const stairs = state.currentFloor.stairs;
  if (state.player.x !== stairs.x || state.player.y !== stairs.y) return;
  await withBusy("Generating next floor", async () => {
    await enterFloor(state.floor + 1);
  });
}

async function takeRest() {
  if (!state || busy) return;
  const healed = Math.min(5, state.player.maxHp - state.player.hp);
  if (healed <= 0) {
    appendLog("You are already steady.");
  } else {
    state.player.hp += healed;
    appendLog(`You rest beside the prompt and recover ${healed} HP.`);
  }
  composer?.sfx("rest");
  state.turn += 1;
  enemyTurn();
  checkDefeat();
  await saveRun();
  render();
}

async function requestStoryBeat() {
  if (!state || busy) return;
  await withBusy("Asking director for a beat", async () => {
    const beat = await director.generateBeat(state);
    state.generated.beats.push(beat);
    appendLog(`${beat.title}: ${beat.text}`);
    if (beat.reward && state.inventory.length < 8) {
      state.inventory.push(beat.reward);
      appendLog(`${beat.reward} joins your pack.`);
    }
    composer?.sfx("beat");
  });
  await saveRun();
  render();
}

async function warmQwen() {
  if (!state) return;
  state.settings.provider = "qwen";
  dom.provider.value = "qwen";
  await withBusy("Warming Browser Qwen", async () => {
    await qwen.warm((message) => {
      dom.modelNote.textContent = message;
      setEngine(message);
    });
    appendLog("Browser Qwen is warm. Future uncached chunks will ask it first.");
  });
  await saveRun();
  render();
}

function completeQuest(message) {
  if (state.generated.story.quest.done) return;
  state.generated.story.quest.done = true;
  state.player.xp += 12;
  state.player.maxHp += 4;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
  composer?.sfx("quest");
  appendLog(`${message} +12 XP, +4 max HP.`);
}

function checkDefeat() {
  if (state.player.hp > 0) return;
  state.player.hp = 0;
  composer?.sfx("down");
  appendLog("The run falls silent. Start a new story seed to try again.");
  setEngine("Run ended");
}

function render() {
  if (!state || !state.currentFloor) return;
  const floor = state.currentFloor;
  dom.board.style.setProperty("--cols", String(floor.width));
  dom.board.classList.toggle("board-hit", Date.now() < fx.boardHitUntil);
  dom.board.innerHTML = "";
  const reveal = fx.revealDepth === floor.depth && Date.now() - fx.revealAt < 1600;
  for (let y = 0; y < floor.height; y += 1) {
    for (let x = 0; x < floor.width; x += 1) {
      const tile = document.createElement("div");
      const base = tileAt(floor, x, y);
      let glyph = base === "#" ? "#" : ".";
      let kind = base === "#" ? "wall" : "floor";
      const landmark = floor.landmarks.find((item) => item.x === x && item.y === y);
      const item = floor.items.find((candidate) => !candidate.taken && candidate.x === x && candidate.y === y);
      const enemy = floor.enemies.find((candidate) => !candidate.dead && candidate.x === x && candidate.y === y);
      if (floor.stairs.x === x && floor.stairs.y === y) {
        glyph = ">";
        kind = "stairs";
      }
      if (landmark) {
        glyph = "?";
        kind = "landmark";
      }
      if (item) {
        glyph = item.kind === "heal" ? "+" : "*";
        kind = "item";
      }
      if (enemy) {
        glyph = enemy.glyph || "e";
        kind = "enemy";
      }
      if (state.player.x === x && state.player.y === y) {
        glyph = "@";
        kind = "player";
      }
      const classes = ["tile", kind];
      if (reveal) {
        classes.push("reveal");
        const delay = Math.min(420, (Math.abs(x - state.player.x) + Math.abs(y - state.player.y)) * 22);
        tile.style.setProperty("--delay", `${delay}ms`);
      }
      if (fx.tileKey === coordKey(x, y)) classes.push(`fx-${fx.tileKind}`);
      tile.className = classes.join(" ");
      tile.textContent = glyph;
      tile.title = describeTile(kind, enemy, item, landmark);
      dom.board.append(tile);
    }
  }

  const story = state.generated.story;
  dom.floorLabel.textContent = `Floor ${state.floor}`;
  dom.placeName.textContent = floor.name;
  dom.turn.textContent = `Turn ${state.turn}`;
  dom.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
  dom.xp.textContent = String(state.player.xp);
  dom.gold.textContent = String(state.player.gold);
  dom.questTitle.textContent = story.quest.done ? `${story.quest.title} (done)` : story.quest.title;
  dom.questCopy.textContent = story.quest.description;
  dom.provider.value = state.settings.provider;
  dom.inventory.innerHTML = state.inventory.length
    ? state.inventory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Empty</li>";
  dom.log.innerHTML = state.log.slice(-10).reverse().map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  dom.modelNote.textContent = qwen.ready
    ? "Browser Qwen is warm."
    : state.settings.provider === "qwen"
      ? "Warm Qwen before uncached generation."
      : "Pocket generator is active.";
  syncMusicButton();
}

function describeTile(kind, enemy, item, landmark) {
  if (enemy) return `${enemy.name} (${enemy.hp} HP)`;
  if (item) return item.name;
  if (landmark) return landmark.name;
  if (kind === "stairs") return "Next floor";
  if (kind === "player") return "You";
  return kind;
}

function appendLog(line) {
  if (!state) return;
  state.log.push(line);
  if (state.log.length > 80) state.log = state.log.slice(-80);
}

function markFx(kind, x, y) {
  fx.tileKind = kind;
  fx.tileKey = coordKey(x, y);
}

async function toggleMusic() {
  if (!state) {
    composer = composer || new AdaptiveComposer();
    const enabled = dom.musicToggle.dataset.enabled !== "false";
    dom.musicToggle.dataset.enabled = enabled ? "false" : "true";
    dom.musicToggle.textContent = enabled ? "Music Off" : "Music On";
    dom.musicStatus.textContent = enabled ? "score muted" : "seed score armed";
    if (enabled) composer.stop();
    return;
  }
  state.settings.musicEnabled = !state.settings.musicEnabled;
  if (state.settings.musicEnabled) await startMusic();
  else composer?.stop();
  await saveRun();
  syncMusicButton();
}

async function startMusic() {
  if (!state?.settings?.musicEnabled) {
    syncMusicButton();
    return;
  }
  composer = composer || new AdaptiveComposer();
  try {
    await composer.start(state);
    syncMusicButton();
  } catch (error) {
    dom.musicStatus.textContent = "audio unavailable";
    state.settings.musicEnabled = false;
    syncMusicButton();
  }
}

function syncMusicButton() {
  const enabled = state?.settings?.musicEnabled ?? dom.musicToggle.dataset.enabled !== "false";
  dom.musicToggle.textContent = enabled ? "Music On" : "Music Off";
  dom.musicToggle.dataset.enabled = enabled ? "true" : "false";
  if (!composer?.playing) {
    dom.musicStatus.textContent = enabled ? "seed score armed" : "score muted";
  }
}

function focusBoard() {
  window.setTimeout(() => dom.board.focus(), 0);
}

async function withBusy(label, task) {
  busy = true;
  setEngine(label);
  render();
  try {
    return await task();
  } catch (error) {
    appendLog(error.message);
    await api.ui.notify(`Rogue Shell: ${error.message}`);
  } finally {
    busy = false;
    setEngine("Ready");
  }
}

function setEngine(message) {
  dom.engineStatus.textContent = message;
  syncMusicButton();
}

function tileAt(floor, x, y) {
  return floor.tiles[y]?.[x] || "#";
}

function isInside(floor, x, y) {
  return x >= 0 && y >= 0 && x < floor.width && y < floor.height;
}

function findEnemy(x, y) {
  return livingEnemies().find((enemy) => enemy.x === x && enemy.y === y);
}

function livingEnemies() {
  return state.currentFloor.enemies.filter((enemy) => !enemy.dead);
}

class AdaptiveComposer {
  constructor() {
    this.context = null;
    this.master = null;
    this.timer = null;
    this.playing = false;
    this.step = 0;
    this.tempo = 82;
    this.root = 130.81;
    this.scale = [0, 2, 3, 5, 7, 9, 10, 12];
    this.motif = [0, 2, 4, 5, 3, 1, 2, 6];
    this.wave = "triangle";
  }

  async start(run) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) throw new Error("WebAudio is unavailable.");
    if (!this.context) {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.context.destination);
    }
    this.update(run);
    await this.context.resume();
    this.master.gain.setTargetAtTime(0.055, this.context.currentTime, 0.28);
    this.playing = true;
    this.restartClock();
    dom.musicStatus.textContent = "seed score playing";
  }

  update(run) {
    if (!run) return;
    const story = run.generated?.story;
    const source = `${run.storyPrompt}:${story?.title || ""}:${run.floor || 1}`;
    const rng = rngFor(`music:${hashString(source)}`);
    const roots = [98, 110, 123.47, 130.81, 146.83, 164.81];
    const modes = [
      [0, 2, 3, 5, 7, 8, 10, 12],
      [0, 2, 3, 5, 7, 9, 10, 12],
      [0, 2, 4, 7, 9, 12, 14, 16],
      [0, 1, 5, 7, 8, 12, 13, 17]
    ];
    this.root = choice(rng, roots);
    this.scale = choice(rng, modes);
    this.tempo = 68 + Math.floor(rng() * 32) + Math.min(16, (run.floor || 1) * 2);
    this.wave = rng() > 0.55 ? "triangle" : "sine";
    this.motif = Array.from({ length: 12 }, () => Math.floor(rng() * this.scale.length));
    if (this.playing) this.restartClock();
  }

  restartClock() {
    if (this.timer) window.clearInterval(this.timer);
    const beatMs = 60000 / this.tempo / 2;
    this.timer = window.setInterval(() => this.tick(), beatMs);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.14);
    }
    dom.musicStatus.textContent = "score muted";
  }

  tick() {
    if (!this.context || !this.master || !this.playing) return;
    const index = this.step % this.motif.length;
    const degree = this.motif[index];
    const octave = index % 7 === 0 ? 2 : 1;
    const freq = this.noteFrequency(degree, octave);
    this.tone(freq, 0.16, this.wave, 0.055);
    if (this.step % 4 === 0) this.tone(this.noteFrequency(0, 0), 0.42, "sine", 0.04);
    if (this.step % 8 === 6) this.tone(this.noteFrequency(4, 1), 0.22, "square", 0.018);
    this.step += 1;
  }

  sfx(kind) {
    if (!this.context || !this.master) return;
    if (kind === "move") this.tone(this.noteFrequency(2, 2), 0.045, "sine", 0.03);
    if (kind === "bump") this.tone(72, 0.07, "sawtooth", 0.045);
    if (kind === "hit") this.tone(this.noteFrequency(5, 2), 0.09, "square", 0.055);
    if (kind === "pickup") this.arpeggio([2, 4, 6], 0.05, 0.038);
    if (kind === "heal") this.arpeggio([0, 2, 4, 7], 0.055, 0.035);
    if (kind === "stairs") this.arpeggio([0, 3, 5, 7, 10], 0.075, 0.045);
    if (kind === "rest") this.tone(this.noteFrequency(0, 1), 0.28, "sine", 0.035);
    if (kind === "beat") this.arpeggio([1, 3, 5], 0.07, 0.03);
    if (kind === "quest") this.arpeggio([0, 2, 4, 6, 8], 0.08, 0.05);
    if (kind === "down") this.arpeggio([5, 3, 1, 0], 0.11, 0.04);
  }

  arpeggio(degrees, duration, gain) {
    degrees.forEach((degree, index) => {
      this.tone(this.noteFrequency(degree, 2), duration, "triangle", gain, index * duration * 0.72);
    });
  }

  noteFrequency(degree, octave) {
    const semitone = this.scale[Math.abs(degree) % this.scale.length] + octave * 12;
    return this.root * Math.pow(2, semitone / 12);
  }

  tone(freq, duration, type, gainValue, delay = 0) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }
}

class ContentDirector {
  constructor({ qwen }) {
    this.qwen = qwen;
  }

  async ensureStory(run) {
    if (run.generated.story) return run.generated.story;
    const fallback = () => createProceduralStory(run.storyPrompt, run.seed);
    run.generated.story = await this.generateJson(run, {
      kind: "story",
      maxNewTokens: 520,
      fallback,
      prompt: [
        "Create compact JSON for a roguelike story bible.",
        "Keys: title, premise, finalGoal, biomes, factions, enemies, items, quest.",
        "quest must include title, description and target. target is relic or defeat.",
        `User seed: ${run.storyPrompt}`
      ].join("\n")
    });
    run.generated.story = normalizeStory(run.generated.story, fallback());
    return run.generated.story;
  }

  async ensureFloor(run, depth) {
    const key = String(depth);
    if (run.generated.floors[key]) return run.generated.floors[key];
    await this.ensureStory(run);
    const fallback = () => createProceduralFloor(run, depth, null);
    const floorFlavor = await this.generateJson(run, {
      kind: "floor",
      maxNewTokens: 380,
      fallback: () => ({}),
      prompt: [
        "Create compact JSON metadata for one roguelike floor.",
        "Keys: name, mood, objective, enemyNames, itemNames, landmarkNames.",
        `Story: ${JSON.stringify(run.generated.story)}`,
        `Floor: ${depth}`
      ].join("\n")
    });
    run.generated.floors[key] = createProceduralFloor(run, depth, floorFlavor);
    return run.generated.floors[key];
  }

  async generateBeat(run) {
    await this.ensureStory(run);
    const fallback = () => createProceduralBeat(run);
    const beat = await this.generateJson(run, {
      kind: "beat",
      maxNewTokens: 260,
      fallback,
      prompt: [
        "Create compact JSON for a single roguelike event beat.",
        "Keys: title, text, reward.",
        `Story: ${JSON.stringify(run.generated.story)}`,
        `Floor: ${run.floor}`,
        `Inventory: ${run.inventory.join(", ") || "empty"}`
      ].join("\n")
    });
    return normalizeBeat(beat, fallback());
  }

  async generateJson(run, request) {
    if (run.settings.provider !== "qwen") return request.fallback();
    if (!this.qwen.ready) {
      appendLog("Browser Qwen is not warm, so the director used the pocket generator.");
      return request.fallback();
    }
    try {
      const result = await this.qwen.generateJson(request.prompt, request.maxNewTokens);
      appendLog(`Browser Qwen generated ${request.kind}.`);
      return result;
    } catch (error) {
      appendLog(`Qwen fallback for ${request.kind}: ${error.message}`);
      return request.fallback();
    }
  }
}

class BrowserQwenProvider {
  constructor() {
    this.ready = false;
    this.pipe = null;
    this.model = "Mozilla/Qwen2.5-0.5B-Instruct";
  }

  async warm(progress) {
    if (this.ready) return;
    if (!("gpu" in navigator)) {
      throw new Error("WebGPU is unavailable in this browser frame.");
    }
    progress("Importing Transformers.js");
    const module = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2");
    const { pipeline, env } = module;
    if (env) {
      env.allowLocalModels = false;
      if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.proxy = true;
    }
    progress("Loading Qwen 0.5B");
    this.pipe = await pipeline("text-generation", this.model, {
      device: "webgpu",
      dtype: "q4f16"
    });
    this.ready = true;
  }

  async generateJson(prompt, maxNewTokens) {
    if (!this.ready || !this.pipe) throw new Error("Qwen is not ready.");
    const fullPrompt = [
      "You are the content engine for Rogue Shell, a small roguelike.",
      "Return only valid compact JSON. No markdown.",
      prompt
    ].join("\n\n");
    const output = await this.pipe(fullPrompt, {
      max_new_tokens: maxNewTokens,
      temperature: 0.7,
      do_sample: true,
      return_full_text: false
    });
    const text = Array.isArray(output)
      ? String(output[0]?.generated_text || output[0]?.text || "")
      : String(output?.generated_text || output || "");
    return parseJsonBlock(text);
  }
}

function createProceduralStory(prompt, seed) {
  const rng = rngFor(`story:${seed}`);
  const theme = inferTheme(prompt);
  const title = `${choice(rng, theme.titleA)} ${choice(rng, theme.titleB)}`;
  const factionA = `${choice(rng, theme.factionA)} ${choice(rng, theme.factionB)}`;
  const factionB = `${choice(rng, theme.rivalA)} ${choice(rng, theme.rivalB)}`;
  const relic = `${choice(rng, theme.relicA)} ${choice(rng, theme.relicB)}`;
  return {
    title,
    premise: sentenceCase(prompt || DEFAULT_PROMPT),
    finalGoal: `Reach the root chamber and claim the ${relic}.`,
    biomes: shuffle(rng, theme.biomes).slice(0, 6),
    factions: [factionA, factionB],
    enemies: shuffle(rng, theme.enemies).slice(0, 8),
    items: shuffle(rng, [relic, ...theme.items]).slice(0, 8),
    quest: {
      title: `Recover ${relic}`,
      description: `Find the ${relic} before ${factionB} rewrites this run.`,
      target: rng() > 0.35 ? "relic" : "defeat",
      done: false
    }
  };
}

function createProceduralFloor(run, depth, flavor) {
  const story = run.generated.story;
  const rng = rngFor(`floor:${run.seed}:${depth}`);
  const width = 23;
  const height = 15;
  const rooms = carveRooms(rng, width, height);
  const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => "#"));

  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) tiles[y][x] = ".";
    }
  }
  for (let index = 1; index < rooms.length; index += 1) {
    carveCorridor(tiles, centerOf(rooms[index - 1]), centerOf(rooms[index]));
  }

  const start = centerOf(rooms[0]);
  const stairs = centerOf(rooms[rooms.length - 1]);
  const name = safeText(flavor?.name) || `${choice(rng, story.biomes)} ${depth}`;
  const enemyNames = arrayOr(flavor?.enemyNames, story.enemies);
  const itemNames = arrayOr(flavor?.itemNames, story.items);
  const landmarkNames = arrayOr(flavor?.landmarkNames, ["sealed prompt", "quiet archive", "broken index"]);
  const occupied = new Set([coordKey(start.x, start.y), coordKey(stairs.x, stairs.y)]);
  const enemies = [];
  const enemyCount = Math.min(6, 2 + Math.floor(depth / 2) + Math.floor(rng() * 2));
  for (let index = 0; index < enemyCount; index += 1) {
    const spot = placeInRoom(rng, rooms, occupied);
    enemies.push({
      id: `e${depth}-${index}`,
      name: choice(rng, enemyNames),
      glyph: "e",
      x: spot.x,
      y: spot.y,
      hp: 7 + depth * 2 + Math.floor(rng() * 5),
      atk: 2 + Math.floor(depth / 2)
    });
  }

  const items = [];
  const itemCount = 2 + Math.floor(rng() * 3);
  for (let index = 0; index < itemCount; index += 1) {
    const spot = placeInRoom(rng, rooms, occupied);
    const quest = depth === 2 && index === 0 && story.quest.target === "relic";
    items.push({
      id: `i${depth}-${index}`,
      name: quest ? story.items[0] : choice(rng, itemNames),
      kind: rng() > 0.62 && !quest ? "heal" : "trinket",
      power: 5 + Math.floor(rng() * 7),
      quest,
      x: spot.x,
      y: spot.y
    });
  }

  const landmarkSpot = placeInRoom(rng, rooms, occupied);
  const mood = safeText(flavor?.mood) || choice(rng, ["watchful", "fractured", "bright with static", "too quiet"]);
  const objective = safeText(flavor?.objective) || `Find the stairwell beneath ${name}.`;

  return {
    depth,
    name,
    mood,
    objective,
    width,
    height,
    start,
    stairs,
    tiles: tiles.map((row) => row.join("")),
    enemies,
    items,
    landmarks: [
      {
        name: choice(rng, landmarkNames),
        text: `${mood}. ${objective}`,
        x: landmarkSpot.x,
        y: landmarkSpot.y
      }
    ]
  };
}

function createProceduralBeat(run) {
  const rng = rngFor(`beat:${run.seed}:${run.turn}:${run.generated.beats.length}`);
  const story = run.generated.story;
  const title = choice(rng, ["A forked prompt", "A cached whisper", "A door with no key", "An old shell alias", "A false minimap"]);
  const text = choice(rng, [
    `${choice(rng, story.factions)} left a warning carved into the wall.`,
    `The floor briefly remembers ${story.finalGoal.toLowerCase()}`,
    `A minor daemon offers a trade, then forgets its own price.`,
    `The vault hums in the rhythm of your original story seed.`
  ]);
  return {
    title,
    text,
    reward: rng() > 0.72 ? choice(rng, story.items) : ""
  };
}

function inferTheme(prompt) {
  const text = prompt.toLowerCase();
  if (text.includes("space") || text.includes("moon") || text.includes("star")) return THEMES.cosmic;
  if (text.includes("forest") || text.includes("fung") || text.includes("root")) return THEMES.wild;
  if (text.includes("castle") || text.includes("king") || text.includes("dragon")) return THEMES.citadel;
  if (text.includes("ghost") || text.includes("haunt") || text.includes("grave")) return THEMES.haunt;
  return THEMES.archive;
}

const THEMES = {
  archive: {
    titleA: ["Archive", "Vault", "Index", "Cipher"],
    titleB: ["Below", "Errant", "Awake", "Unbound"],
    factionA: ["Glass", "Root", "Cipher", "Lantern"],
    factionB: ["Keepers", "Menders", "Clerks", "Pilgrims"],
    rivalA: ["Null", "Mirror", "Redline", "Static"],
    rivalB: ["Scribes", "Ghosts", "Auditors", "Knights"],
    relicA: ["Root", "Prime", "Last", "Hidden"],
    relicB: ["Key", "Index", "Shell", "Ledger"],
    biomes: ["Salt Archive", "Checksum Hall", "Mirror Cache", "Amber Stack", "Root Atrium", "Quiet Kernel"],
    enemies: ["Null Scribe", "Patch Wraith", "Index Leech", "Broken Clerk", "Lint Knight", "Forked Echo"],
    items: ["warm checksum", "silver alias", "glass token", "patched lantern", "little root key", "amber macro"]
  },
  cosmic: {
    titleA: ["Moon", "Comet", "Nebula", "Orbit"],
    titleB: ["Ruin", "Signal", "Descent", "Archive"],
    factionA: ["Lunar", "Signal", "Aurora", "Vacuum"],
    factionB: ["Cartographers", "Miners", "Choirs", "Wardens"],
    rivalA: ["Eclipse", "Meteor", "Blackbox", "Red Star"],
    rivalB: ["Ghosts", "Corsairs", "Engines", "Saints"],
    relicA: ["Fallen", "Zero-G", "Silver", "Orbital"],
    relicB: ["Crown", "Keystone", "Compass", "Seed"],
    biomes: ["Crater Vault", "Oxygen Garden", "Static Observatory", "Meteor Choir", "Black Dock", "Solar Crypt"],
    enemies: ["Vacuum Ghoul", "Meteor Rat", "Eclipse Monk", "Suit Husk", "Starved Drone", "Orbital Thief"],
    items: ["moon ration", "ion spur", "crater pearl", "solar needle", "vacuum charm", "silver flare"]
  },
  wild: {
    titleA: ["Root", "Moss", "Thorn", "Spore"],
    titleB: ["Covenant", "Labyrinth", "Bloom", "Signal"],
    factionA: ["Moss", "Thorn", "Feral", "Rain"],
    factionB: ["Archivists", "Hunters", "Sisters", "Wardens"],
    rivalA: ["Ash", "Hollow", "Rust", "Briar"],
    rivalB: ["Druids", "Wolves", "Kings", "Oracles"],
    relicA: ["Verdant", "Last", "Buried", "Living"],
    relicB: ["Seed", "Crown", "Blade", "Bell"],
    biomes: ["Mushroom Kernel", "Rain Cache", "Briar Hall", "Root Chapel", "Green Static", "Pollen Gate"],
    enemies: ["Moss Thief", "Spore Saint", "Briar Hex", "Root Mite", "Rain Ghast", "Feral Clerk"],
    items: ["dew vial", "thorn coin", "green lantern", "root charm", "spore bread", "moss key"]
  },
  citadel: {
    titleA: ["Crown", "Keep", "Dragon", "Iron"],
    titleB: ["Below", "Oath", "Vault", "Trial"],
    factionA: ["Iron", "Crown", "Banner", "Oathbound"],
    factionB: ["Knights", "Smiths", "Judges", "Pages"],
    rivalA: ["Ashen", "False", "Hollow", "Exiled"],
    rivalB: ["Kings", "Dragons", "Orders", "Bishops"],
    relicA: ["Crowned", "Old", "Iron", "Dragon"],
    relicB: ["Seal", "Helm", "Charter", "Ember"],
    biomes: ["Soot Keep", "Banner Vault", "Chapel Armory", "Dragon Stack", "Oath Cellar", "Iron Library"],
    enemies: ["Ash Knight", "Soot Page", "Dragon Bailiff", "Oath Wraith", "False Bishop", "Helm Spider"],
    items: ["oath ring", "little helm", "ember ration", "iron seal", "banner scrap", "charter key"]
  },
  haunt: {
    titleA: ["Ghost", "Grave", "Candle", "Hollow"],
    titleB: ["Directory", "Mass", "House", "Signal"],
    factionA: ["Candle", "Hollow", "Grave", "Veiled"],
    factionB: ["Mediums", "Archivists", "Choirs", "Witnesses"],
    rivalA: ["Hungry", "Pale", "Locked", "Nameless"],
    rivalB: ["Dead", "Masks", "Choirs", "Judges"],
    relicA: ["Last", "Pale", "Candlelit", "Buried"],
    relicB: ["Name", "Bell", "Locket", "Witness"],
    biomes: ["Candle Cache", "Grave Index", "Whisper Hall", "Pale Nursery", "Locked Choir", "Mourning Root"],
    enemies: ["Candle Wraith", "Grave Clerk", "Pale Witness", "Name Eater", "Locked Choirboy", "Dust Medium"],
    items: ["candle stub", "grave coin", "pale locket", "witness bell", "salt thread", "mourning ribbon"]
  }
};

function carveRooms(rng, width, height) {
  const rooms = [];
  for (let attempt = 0; attempt < 60 && rooms.length < 7; attempt += 1) {
    const w = 4 + Math.floor(rng() * 5);
    const h = 3 + Math.floor(rng() * 4);
    const x = 1 + Math.floor(rng() * (width - w - 2));
    const y = 1 + Math.floor(rng() * (height - h - 2));
    const room = { x, y, w, h };
    const overlaps = rooms.some((other) => !(x + w + 1 < other.x || other.x + other.w + 1 < x || y + h + 1 < other.y || other.y + other.h + 1 < y));
    if (!overlaps) rooms.push(room);
  }
  if (rooms.length < 3) {
    rooms.push({ x: 2, y: 2, w: 6, h: 4 }, { x: width - 9, y: height - 6, w: 6, h: 4 }, { x: 9, y: 7, w: 5, h: 4 });
  }
  return rooms;
}

function carveCorridor(tiles, from, to) {
  let x = from.x;
  let y = from.y;
  while (x !== to.x) {
    tiles[y][x] = ".";
    x += Math.sign(to.x - x);
  }
  while (y !== to.y) {
    tiles[y][x] = ".";
    y += Math.sign(to.y - y);
  }
  tiles[y][x] = ".";
}

function centerOf(room) {
  return {
    x: room.x + Math.floor(room.w / 2),
    y: room.y + Math.floor(room.h / 2)
  };
}

function placeInRoom(rng, rooms, occupied) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const room = choice(rng, rooms.slice(1));
    const x = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
    const y = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
    const key = coordKey(x, y);
    if (!occupied.has(key)) {
      occupied.add(key);
      return { x, y };
    }
  }
  return centerOf(rooms[rooms.length - 1]);
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function normalizeStory(candidate, fallback) {
  const story = {
    title: safeText(candidate?.title) || fallback.title,
    premise: safeText(candidate?.premise) || fallback.premise,
    finalGoal: safeText(candidate?.finalGoal) || fallback.finalGoal,
    biomes: arrayOr(candidate?.biomes, fallback.biomes).slice(0, 8),
    factions: arrayOr(candidate?.factions, fallback.factions).slice(0, 4),
    enemies: arrayOr(candidate?.enemies, fallback.enemies).slice(0, 10),
    items: arrayOr(candidate?.items, fallback.items).slice(0, 10),
    quest: {
      title: safeText(candidate?.quest?.title) || fallback.quest.title,
      description: safeText(candidate?.quest?.description) || fallback.quest.description,
      target: ["relic", "defeat"].includes(candidate?.quest?.target) ? candidate.quest.target : fallback.quest.target,
      done: false
    }
  };
  if (!story.biomes.length) story.biomes = fallback.biomes;
  if (!story.enemies.length) story.enemies = fallback.enemies;
  if (!story.items.length) story.items = fallback.items;
  return story;
}

function normalizeBeat(candidate, fallback) {
  return {
    title: safeText(candidate?.title) || fallback.title,
    text: safeText(candidate?.text) || fallback.text,
    reward: safeText(candidate?.reward) || fallback.reward || ""
  };
}

function parseJsonBlock(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Model did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

function arrayOr(value, fallback) {
  return Array.isArray(value) && value.length
    ? value.map((item) => safeText(item)).filter(Boolean)
    : fallback;
}

function safeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

function sentenceCase(value) {
  const text = safeText(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : DEFAULT_PROMPT;
}

function shuffle(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function choice(rng, items) {
  return items[Math.floor(rng() * items.length)] || items[0];
}

function rngFor(value) {
  return mulberry32(hashString(value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createShellexApi() {
  if (window.shellex) return window.shellex;
  const storageKey = "rogue-shell-standalone-store";
  const readStore = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  };
  const writeStore = (store) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // Standalone preview can keep playing without persistence.
    }
  };
  return {
    fs: {
      async readFile(path) {
        const store = readStore();
        if (!(path in store)) throw new Error(`No file: ${path}`);
        return store[path];
      },
      async writeFile(path, content) {
        const store = readStore();
        store[path] = String(content);
        writeStore(store);
        return true;
      },
      async listDir(path) {
        const prefix = path.endsWith("/") ? path : `${path}/`;
        return Object.keys(readStore())
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ name: key.slice(prefix.length), type: "file" }));
      }
    },
    ui: {
      async notify(message) {
        setEngine(message);
        return true;
      }
    },
    runtime: {
      async getAppInfo() {
        return { id: APP_ID, name: "Rogue Shell", vaultLabel: "standalone" };
      }
    }
  };
}

qwen = new BrowserQwenProvider();
director = new ContentDirector({ qwen });
bindUi();
setEngine("Ready");
