const APP_ID = "games.rogue-shell.local";
const DATA_DIR = `/appdata/${APP_ID}`;
const SAVE_PATH = `${DATA_DIR}/save.json`;
const DEFAULT_PROMPT = "A broken moon has fallen into an encrypted archive. I am a scavenger trying to reach the root directory before rival ghosts rewrite the world.";

const dom = {
  app: document.querySelector("[data-app]"),
  shell: document.querySelector(".game-shell"),
  headerMode: document.querySelector("[data-header-mode]"),
  setup: document.querySelector("[data-setup]"),
  play: document.querySelector("[data-play]"),
  prompt: document.querySelector("[data-story-prompt]"),
  start: document.querySelector("[data-start]"),
  load: document.querySelector("[data-load]"),
  setupDirector: document.querySelector("[data-setup-director]"),
  setupModelNote: document.querySelector("[data-setup-model-note]"),
  prepareQwen: document.querySelector("[data-prepare-qwen]"),
  providerChoices: Array.from(document.querySelectorAll("[data-provider-choice]")),
  board: document.querySelector("[data-board]"),
  boardFrame: document.querySelector(".board-frame"),
  sidePanel: document.querySelector(".side-panel"),
  engineStatus: document.querySelector("[data-engine-status]"),
  floorLabel: document.querySelector("[data-floor-label]"),
  placeName: document.querySelector("[data-place-name]"),
  turn: document.querySelector("[data-turn]"),
  hp: document.querySelector("[data-hp]"),
  level: document.querySelector("[data-level]"),
  xp: document.querySelector("[data-xp]"),
  gold: document.querySelector("[data-gold]"),
  might: document.querySelector("[data-might]"),
  guard: document.querySelector("[data-guard]"),
  focus: document.querySelector("[data-focus]"),
  attack: document.querySelector("[data-attack]"),
  equipment: document.querySelector("[data-equipment]"),
  questTitle: document.querySelector("[data-quest-title]"),
  questCopy: document.querySelector("[data-quest-copy]"),
  inventory: document.querySelector("[data-inventory]"),
  log: document.querySelector("[data-log]"),
  directorMode: document.querySelector("[data-director-mode]"),
  modelNote: document.querySelector("[data-model-note]"),
  panelTabs: Array.from(document.querySelectorAll("[data-panel-tab]")),
  panelPages: Array.from(document.querySelectorAll("[data-panel-page]")),
  panelToggle: document.querySelector("[data-panel-toggle]"),
  rest: document.querySelector("[data-rest]"),
  interact: document.querySelector("[data-interact]"),
  nextBeat: document.querySelector("[data-next-beat]"),
  save: document.querySelector("[data-save]"),
  newRun: document.querySelector("[data-new-run]"),
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
let boardObserver = null;
let setupSettings = { provider: "procedural" };
let activePanel = "hero";
let sidePanelOpen = false;

function bindUi() {
  dom.start.addEventListener("click", () => startRun());
  dom.load.addEventListener("click", () => loadRun());
  dom.rest.addEventListener("click", () => takeRest());
  dom.interact.addEventListener("click", () => interact());
  dom.nextBeat.addEventListener("click", () => requestStoryBeat());
  dom.save.addEventListener("click", () => saveRun(true));
  dom.newRun.addEventListener("click", () => returnToIntro());
  dom.prepareQwen.addEventListener("click", () => prepareQwen());
  dom.musicToggle.addEventListener("click", () => toggleMusic());
  dom.inventory.addEventListener("click", (event) => handleInventoryClick(event));
  dom.panelToggle.addEventListener("click", () => setSidePanelOpen(!sidePanelOpen));
  dom.providerChoices.forEach((button) => {
    button.addEventListener("click", () => setProviderChoice(button.dataset.providerChoice));
  });
  dom.panelTabs.forEach((button) => {
    button.addEventListener("click", () => setActivePanel(button.dataset.panelTab));
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
    if (key === "escape" && sidePanelOpen) {
      event.preventDefault();
      setSidePanelOpen(false);
      return;
    }
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
    if (key === "e" || key === "enter") {
      event.preventDefault();
      interact();
    }
  });
  if ("ResizeObserver" in window) {
    boardObserver = new ResizeObserver(() => fitBoard());
    boardObserver.observe(dom.boardFrame);
  }
  window.addEventListener("resize", () => fitBoard());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusicForLifecycle("score paused");
  });
  window.addEventListener("pagehide", disposeMusicForLifecycle);
  window.addEventListener("beforeunload", disposeMusicForLifecycle);
  window.addEventListener("freeze", () => stopMusicForLifecycle("score paused"));
  syncSetupDirector();
  syncPanelTabs();
  syncSidePanel();
}

async function startRun() {
  if (busy) return;
  const requestedProvider = setupSettings.provider;
  if (requestedProvider === "qwen" && !qwen.ready) {
    await prepareQwen();
  }
  const activeProvider = requestedProvider === "qwen" && qwen.ready ? "qwen" : "procedural";
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
      level: 1,
      hp: 24,
      maxHp: 24,
      xpNext: 12,
      xp: 0,
      gold: 0,
      base: {
        might: 2,
        guard: 1,
        focus: 1
      },
      equipment: {
        weapon: null,
        armor: null,
        charm: null
      }
    },
    inventory: [],
    gameOver: false,
    log: [],
    generated: {
      story: null,
      floors: {},
      beats: []
    },
    settings: {
      provider: activeProvider,
      qwenModel: qwen.model,
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
    state = normalizeRun(loaded);
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

async function saveRun(announce = false) {
  if (!state) return;
  if (announce) appendLog("Saved to the Shellex vault.");
  state.updatedAt = new Date().toISOString();
  try {
    await api.fs.writeFile(SAVE_PATH, JSON.stringify(state, null, 2));
    if (announce) {
      await api.ui.notify("Rogue Shell saved.");
      render();
    }
  } catch (error) {
    setEngine(`Save failed: ${error.message}`);
  }
}

function showPlay() {
  dom.setup.hidden = true;
  dom.play.hidden = false;
  setSidePanelOpen(false);
  dom.app.classList.add("is-playing");
  dom.shell.classList.add("is-playing");
  dom.headerMode.textContent = "Run in progress";
  dom.introLine.textContent = "run mounted";
  window.requestAnimationFrame(() => fitBoard());
}

function returnToIntro() {
  stopMusicForLifecycle("score muted");
  dom.play.hidden = true;
  dom.setup.hidden = false;
  dom.app.classList.remove("is-playing");
  dom.shell.classList.remove("is-playing");
  dom.headerMode.textContent = "Story Director Ready";
  setEngine("Ready");
  syncSetupDirector();
  focusPrompt();
}

function focusPrompt() {
  window.setTimeout(() => dom.prompt.focus(), 0);
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
  if (!canAct()) return;
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
  const stats = heroStats();
  const damage = stats.attack + Math.floor(rng() * 4);
  enemy.hp -= damage;
  markFx("hit", enemy.x, enemy.y);
  composer?.sfx("hit");
  appendLog(`You hit ${enemy.name} for ${damage}.`);
  if (enemy.hp <= 0) {
    enemy.dead = true;
    const gold = 2 + Math.floor(rng() * 7) + state.floor;
    state.player.gold += gold;
    gainXp(4 + state.floor);
    appendLog(`${enemy.name} collapses into cache dust. +${gold} gold.`);
    if (state.generated.story.quest.target === "defeat" && livingEnemies().length === 0) {
      completeQuest("The floor is clear. The quest thread tightens.");
    }
  } else {
    const counter = Math.max(1, enemy.atk + Math.floor(rng() * 3) - stats.guard);
    takeDamage(counter);
    appendLog(`${enemy.name} answers for ${counter}.`);
  }
}

function enemyTurn() {
  const floor = state.currentFloor;
  for (const enemy of livingEnemies()) {
    if (state.player.hp <= 0) break;
    const distance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
    if (distance === 1) {
      const damage = Math.max(1, enemy.atk - Math.floor(heroStats().guard / 2));
      takeDamage(damage);
      appendLog(`${enemy.name} claws at your prompt for ${damage}.`);
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
  state.inventory.push(stripWorldItem(item));
  appendLog(`Added ${item.name} to your pack.`);
  markFx("pickup", x, y);
  composer?.sfx(item.kind === "heal" ? "heal" : "pickup");
  if (state.generated.story.quest.target === "relic" && item.quest) {
    completeQuest(`${item.name} answers the quest.`);
  }
}

function inspectLandmark(x, y) {
  const landmark = state.currentFloor.landmarks.find((item) => item.x === x && item.y === y);
  if (!landmark || landmark.hinted) return;
  landmark.hinted = true;
  appendLog(`${landmark.name} hums nearby. Press E or Interact.`);
}

async function interact() {
  if (!canAct()) return;
  const landmark = findReachableLandmark();
  if (!landmark) {
    appendLog("There is nothing close enough to interact with.");
    render();
    return;
  }
  if (landmark.claimed) {
    appendLog(`${landmark.name} is quiet now.`);
    render();
    return;
  }
  landmark.seen = true;
  landmark.claimed = true;
  appendLog(`${landmark.name}: ${landmark.text}`);
  const rng = rngFor(`landmark:${state.seed}:${state.floor}:${landmark.x},${landmark.y}`);
  const roll = rng();
  if (roll < 0.34) {
    const xp = 3 + state.floor;
    gainXp(xp);
    appendLog(`You decode it for ${xp} XP.`);
  } else if (roll < 0.67) {
    const healed = Math.min(state.player.maxHp - state.player.hp, 5 + state.floor);
    state.player.hp += healed;
    appendLog(healed > 0 ? `The mark restores ${healed} HP.` : "The mark steadies you, but you are already whole.");
  } else {
    const gift = createLootItem(choice(rng, state.generated.story.items), "charm", rng, state.floor, `l${state.floor}-${state.turn}`);
    state.inventory.push(gift);
    appendLog(`${gift.name} appears in your pack.`);
  }
  composer?.sfx("beat");
  state.turn += 1;
  enemyTurn();
  checkDefeat();
  await saveRun();
  render();
}

async function maybeUseStairs() {
  const stairs = state.currentFloor.stairs;
  if (state.player.x !== stairs.x || state.player.y !== stairs.y) return;
  await withBusy("Generating next floor", async () => {
    await enterFloor(state.floor + 1);
  });
}

async function takeRest() {
  if (!canAct()) return;
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
  if (!canAct()) return;
  await withBusy("Asking director for a beat", async () => {
    const beat = await director.generateBeat(state);
    state.generated.beats.push(beat);
    appendLog(`${beat.title}: ${beat.text}`);
    if (beat.reward && state.inventory.length < 8) {
      const gift = createLootItem(beat.reward, "trinket", rngFor(`beat-item:${state.seed}:${state.turn}:${beat.reward}`), state.floor, `beat-${state.turn}`);
      state.inventory.push(gift);
      appendLog(`${gift.name} joins your pack.`);
    }
    composer?.sfx("beat");
  });
  await saveRun();
  render();
}

async function prepareQwen() {
  if (busy || qwen.ready) return qwen.ready;
  const previousProvider = setupSettings.provider;
  busy = true;
  setupSettings.provider = "qwen";
  syncSetupDirector("Preparing Qwen...");
  setEngine("Preparing Qwen");
  try {
    await qwen.warm((message) => {
      dom.setupModelNote.textContent = message;
      setEngine(message);
    });
    setupSettings.provider = "qwen";
    dom.setupModelNote.textContent = "Qwen ready.";
    setEngine("Qwen ready");
    return true;
  } catch (error) {
    setupSettings.provider = previousProvider === "qwen" ? "procedural" : previousProvider;
    dom.setupModelNote.textContent = "Qwen unavailable in this browser frame. Local director ready.";
    setEngine("Local fallback");
    await api.ui.notify(`Rogue Shell: ${error.message}. Using local director.`);
    return false;
  } finally {
    busy = false;
    syncSetupDirector();
    if (!state) setEngine(qwen.ready ? "Qwen ready" : "Ready");
  }
}

function setProviderChoice(provider) {
  if (busy) return;
  setupSettings.provider = provider === "qwen" ? "qwen" : "procedural";
  syncSetupDirector();
}

function syncSetupDirector(note) {
  const wantsQwen = setupSettings.provider === "qwen";
  dom.providerChoices.forEach((button) => {
    const selected = button.dataset.providerChoice === setupSettings.provider;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.disabled = busy;
  });
  dom.prepareQwen.disabled = busy || qwen.ready;
  dom.prepareQwen.textContent = qwen.ready ? "Qwen Ready" : "Prepare Qwen";
  dom.setupDirector.textContent = wantsQwen
    ? qwen.ready ? "Qwen Director" : "Qwen Pending"
    : "Local Director";
  if (note) {
    dom.setupModelNote.textContent = note;
  } else if (qwen.ready) {
    dom.setupModelNote.textContent = wantsQwen ? "Qwen ready." : "Qwen ready, local selected.";
  } else if (wantsQwen) {
    dom.setupModelNote.textContent = "Qwen selected. It will be prepared before the run.";
  } else {
    dom.setupModelNote.textContent = "Local director ready.";
  }
  if (!state || dom.play.hidden) {
    dom.headerMode.textContent = qwen.ready ? "Qwen Ready" : "Story Director Ready";
  }
}

function setActivePanel(panel) {
  activePanel = ["hero", "quest", "pack", "director"].includes(panel) ? panel : "hero";
  syncPanelTabs();
}

function setSidePanelOpen(open) {
  sidePanelOpen = Boolean(open);
  syncSidePanel();
}

function syncSidePanel() {
  dom.play.classList.toggle("is-panel-open", sidePanelOpen);
  dom.play.classList.toggle("is-panel-collapsed", !sidePanelOpen);
  dom.panelToggle.textContent = sidePanelOpen ? "Hide" : "Menu";
  dom.panelToggle.setAttribute("aria-expanded", sidePanelOpen ? "true" : "false");
  dom.sidePanel.setAttribute("aria-hidden", sidePanelOpen ? "false" : "true");
  dom.sidePanel.toggleAttribute("inert", !sidePanelOpen);
  dom.sidePanel.querySelectorAll("button, input, select, textarea, a[href], [tabindex]").forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    if (!sidePanelOpen) {
      if (!element.dataset.originalTabindex) {
        element.dataset.originalTabindex = element.getAttribute("tabindex") ?? "none";
      }
      element.setAttribute("tabindex", "-1");
      return;
    }
    if (element.dataset.originalTabindex === "none") {
      element.removeAttribute("tabindex");
    } else if (element.dataset.originalTabindex) {
      element.setAttribute("tabindex", element.dataset.originalTabindex);
    }
    delete element.dataset.originalTabindex;
  });
}

function syncPanelTabs() {
  dom.panelTabs.forEach((button) => {
    const selected = button.dataset.panelTab === activePanel;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  dom.panelPages.forEach((page) => {
    page.classList.toggle("is-active", page.dataset.panelPage === activePanel);
  });
}

function completeQuest(message) {
  if (state.generated.story.quest.done) return;
  state.generated.story.quest.done = true;
  gainXp(12);
  state.player.maxHp += 4;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
  composer?.sfx("quest");
  appendLog(`${message} +12 XP, +4 max HP.`);
}

function checkDefeat() {
  if (state.player.hp > 0) return;
  if (state.gameOver) return;
  state.player.hp = 0;
  state.gameOver = true;
  composer?.sfx("down");
  composer?.stop();
  appendLog("The run falls silent. Movement is locked. Start a New Run to try again.");
  setEngine("Run ended");
}

function render() {
  if (!state || !state.currentFloor) return;
  state = normalizeRun(state);
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
        glyph = landmark.claimed ? "!" : "?";
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
  const stats = heroStats();
  const qwenActive = qwen.ready && state.settings.provider === "qwen";
  dom.floorLabel.textContent = `Floor ${state.floor}`;
  dom.placeName.textContent = floor.name;
  dom.headerMode.textContent = state.gameOver ? "Run ended" : qwenActive ? "Qwen Director Active" : "Local Director Active";
  dom.turn.textContent = state.gameOver ? "Defeated" : `Turn ${state.turn}`;
  dom.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
  dom.level.textContent = String(state.player.level);
  dom.xp.textContent = `${state.player.xp}/${state.player.xpNext}`;
  dom.gold.textContent = String(state.player.gold);
  dom.might.textContent = String(stats.might);
  dom.guard.textContent = String(stats.guard);
  dom.focus.textContent = String(stats.focus);
  dom.attack.textContent = String(stats.attack);
  dom.equipment.textContent = equipmentSummary();
  dom.questTitle.textContent = story.quest.done ? `${story.quest.title} (done)` : story.quest.title;
  dom.questCopy.textContent = story.quest.description;
  renderInventory();
  dom.log.innerHTML = state.log.slice(-10).reverse().map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  dom.directorMode.textContent = qwenActive ? "Qwen Director" : "Local Director";
  dom.modelNote.textContent = qwenActive
    ? "Qwen is loaded for uncached chunks."
    : state.settings.provider === "qwen"
      ? "Qwen was not prepared. Local fallback is active."
      : "Stable local generation is active.";
  syncPanelTabs();
  setActionDisabled(state.gameOver || busy);
  dom.play.classList.toggle("game-over", state.gameOver);
  syncMusicButton();
  fitBoard();
}

function describeTile(kind, enemy, item, landmark) {
  if (enemy) return `${enemy.name} (${enemy.hp} HP)`;
  if (item) return item.name;
  if (landmark) return landmark.claimed ? `${landmark.name} (decoded)` : `${landmark.name} (interact)`;
  if (kind === "stairs") return "Next floor";
  if (kind === "player") return "You";
  return kind;
}

function canAct() {
  if (!state || busy) return false;
  if (state.gameOver || state.player.hp <= 0) {
    checkDefeat();
    appendLog("This run is over. Start a New Run to continue.");
    render();
    return false;
  }
  return true;
}

function takeDamage(amount) {
  state.player.hp = Math.max(0, state.player.hp - amount);
  fx.boardHitUntil = Date.now() + 220;
}

function gainXp(amount) {
  if (!amount || amount <= 0) return;
  state.player.xp += amount;
  while (state.player.xp >= state.player.xpNext) {
    state.player.xp -= state.player.xpNext;
    state.player.level += 1;
    state.player.xpNext = Math.floor(state.player.xpNext * 1.35 + 6);
    const growth = ["might", "guard", "focus"][(state.player.level + state.floor) % 3];
    state.player.base[growth] += 1;
    state.player.maxHp += 5;
    state.player.hp = state.player.maxHp;
    appendLog(`Level ${state.player.level}. ${growthLabel(growth)} improved.`);
    composer?.sfx("quest");
  }
}

function growthLabel(stat) {
  return stat === "might" ? "Might" : stat === "guard" ? "Guard" : "Focus";
}

function heroStats() {
  const base = state?.player?.base || { might: 2, guard: 1, focus: 1 };
  const stats = { might: base.might, guard: base.guard, focus: base.focus };
  for (const item of equippedItems()) {
    for (const [key, value] of Object.entries(item.bonus || {})) {
      stats[key] = (stats[key] || 0) + value;
    }
  }
  stats.attack = 2 + stats.might + Math.floor(stats.focus / 2);
  return stats;
}

function equippedItems() {
  if (!state?.player?.equipment) return [];
  return Object.values(state.player.equipment)
    .map((id) => state.inventory.find((item) => item.id === id))
    .filter(Boolean);
}

function equipmentSummary() {
  const items = equippedItems();
  return items.length ? items.map((item) => `${item.slot}: ${item.name}`).join(" | ") : "Nothing equipped.";
}

function renderInventory() {
  if (!state.inventory.length) {
    dom.inventory.innerHTML = `<p class="empty-pack">Empty</p>`;
    return;
  }
  dom.inventory.innerHTML = state.inventory.map((item) => {
    const equipped = isEquipped(item);
    const bonus = Object.entries(item.bonus || {}).map(([key, value]) => `+${value} ${growthLabel(key)}`).join(", ");
    const action = item.kind === "heal"
      ? `<button type="button" data-inventory-action="use" data-item-id="${escapeHtml(item.id)}">Use</button>`
      : item.slot
        ? `<button type="button" data-inventory-action="equip" data-item-id="${escapeHtml(item.id)}">${equipped ? "Unequip" : "Equip"}</button>`
        : "";
    return [
      `<article class="inventory-item ${equipped ? "equipped" : ""}">`,
      `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(itemLabel(item))}${bonus ? ` | ${escapeHtml(bonus)}` : ""}</span></div>`,
      action,
      `</article>`
    ].join("");
  }).join("");
}

function itemLabel(item) {
  if (item.kind === "heal") return `tonic, restores ${item.power} HP`;
  if (item.slot) return `${item.slot} gear`;
  return item.kind || "relic";
}

function handleInventoryClick(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-inventory-action]");
  if (!button || !state) return;
  const item = state.inventory.find((candidate) => candidate.id === button.dataset.itemId);
  if (!item) return;
  if (button.dataset.inventoryAction === "use") useItem(item);
  if (button.dataset.inventoryAction === "equip") toggleEquip(item);
  saveRun();
  render();
}

function useItem(item) {
  if (item.kind !== "heal") return;
  const healed = Math.min(state.player.maxHp - state.player.hp, item.power);
  state.player.hp += healed;
  state.inventory = state.inventory.filter((candidate) => candidate.id !== item.id);
  appendLog(healed > 0 ? `${item.name} restores ${healed} HP.` : `${item.name} was used, but you were already whole.`);
  composer?.sfx("heal");
}

function toggleEquip(item) {
  if (!item.slot) return;
  if (state.player.equipment[item.slot] === item.id) {
    state.player.equipment[item.slot] = null;
    appendLog(`Unequipped ${item.name}.`);
    return;
  }
  state.player.equipment[item.slot] = item.id;
  appendLog(`Equipped ${item.name}.`);
  composer?.sfx("pickup");
}

function isEquipped(item) {
  return Boolean(item.slot && state.player.equipment[item.slot] === item.id);
}

function setActionDisabled(disabled) {
  document.querySelectorAll("[data-act], [data-rest], [data-next-beat], [data-interact]").forEach((button) => {
    button.disabled = disabled;
  });
}

function fitBoard() {
  if (!state?.currentFloor || !dom.boardFrame) return;
  const frame = dom.boardFrame.getBoundingClientRect();
  const width = Math.max(180, frame.width - 8);
  const height = Math.max(120, frame.height - 8);
  const ratio = state.currentFloor.width / state.currentFloor.height;
  const fittedWidth = Math.min(width, height * ratio);
  const fittedHeight = fittedWidth / ratio;
  dom.board.style.width = `${Math.floor(fittedWidth)}px`;
  dom.board.style.height = `${Math.floor(fittedHeight)}px`;
}

function findReachableLandmark() {
  const floor = state.currentFloor;
  return floor.landmarks.find((landmark) => {
    const distance = Math.abs(landmark.x - state.player.x) + Math.abs(landmark.y - state.player.y);
    return distance <= 1;
  });
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
  if (!composer?.playing) {
    state.settings.musicEnabled = true;
    await startMusic();
  } else {
    state.settings.musicEnabled = false;
    composer.stop();
  }
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

function stopMusicForLifecycle(status = "score muted") {
  composer?.stop({ suspend: true, status });
  if (dom.musicStatus) dom.musicStatus.textContent = status;
}

function disposeMusicForLifecycle() {
  composer?.dispose();
  composer = null;
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
    setEngine(state?.gameOver ? "Run ended" : "Ready");
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
    if (!this.context || this.context.state === "closed") {
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

  stop(options = {}) {
    const { suspend = false, status = "score muted" } = options;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.master && this.context && this.context.state !== "closed") {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0.0001, now, 0.06);
      if (suspend && this.context.state === "running") {
        this.context.suspend().catch(() => {});
      }
    }
    dom.musicStatus.textContent = status;
  }

  dispose() {
    this.stop({ status: "score muted" });
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context && context.state !== "closed") {
      context.close().catch(() => {});
    }
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
        `Inventory: ${run.inventory.map((item) => item.name).join(", ") || "empty"}`
      ].join("\n")
    });
    return normalizeBeat(beat, fallback());
  }

  async generateJson(run, request) {
    if (run.settings.provider !== "qwen") return request.fallback();
    if (!this.qwen.ready) {
      appendLog("Browser Qwen is not prepared, so the director used the pocket generator.");
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
    const name = quest ? story.items[0] : choice(rng, itemNames);
    const loot = createLootItem(name, quest ? "charm" : "trinket", rng, depth, `${depth}-${index}`);
    items.push({
      ...loot,
      id: `i${depth}-${index}-${loot.id}`,
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

function normalizeRun(run) {
  const normalized = run || {};
  normalized.settings = {
    provider: "procedural",
    qwenModel: "Mozilla/Qwen2.5-0.5B-Instruct",
    musicEnabled: true,
    ...(normalized.settings || {})
  };
  normalized.player = {
    x: 1,
    y: 1,
    level: 1,
    hp: 24,
    maxHp: 24,
    xp: 0,
    xpNext: 12,
    gold: 0,
    base: { might: 2, guard: 1, focus: 1 },
    equipment: { weapon: null, armor: null, charm: null },
    ...(normalized.player || {})
  };
  normalized.player.base = {
    might: 2,
    guard: 1,
    focus: 1,
    ...(normalized.player.base || {})
  };
  normalized.player.equipment = {
    weapon: null,
    armor: null,
    charm: null,
    ...(normalized.player.equipment || {})
  };
  normalized.inventory = (normalized.inventory || []).map((item, index) => {
    if (typeof item === "string") {
      return createLootItem(item, "trinket", rngFor(`migrate:${item}:${index}`), normalized.floor || 1, `old-${index}`);
    }
    return {
      id: item.id || `item-${index}-${hashString(item.name || "item")}`,
      name: safeText(item.name) || "unknown item",
      kind: item.kind || "trinket",
      slot: item.slot || null,
      power: item.power || 0,
      bonus: item.bonus || {},
      quest: Boolean(item.quest)
    };
  });
  for (const [slot, id] of Object.entries(normalized.player.equipment)) {
    if (id && !normalized.inventory.some((item) => item.id === id && item.slot === slot)) normalized.player.equipment[slot] = null;
  }
  normalized.generated = normalized.generated || { story: null, floors: {}, beats: [] };
  normalized.generated.floors = normalized.generated.floors || {};
  for (const [key, floor] of Object.entries(normalized.generated.floors)) {
    normalized.generated.floors[key] = normalizeFloor(floor, Number(key) || normalized.floor || 1);
  }
  if (normalized.currentFloor) normalized.currentFloor = normalizeFloor(normalized.currentFloor, normalized.floor || 1);
  normalized.generated.beats = normalized.generated.beats || [];
  normalized.log = normalized.log || [];
  normalized.gameOver = Boolean(normalized.gameOver || normalized.player.hp <= 0);
  return normalized;
}

function normalizeFloor(floor, depth) {
  if (!floor) return floor;
  const rng = rngFor(`floor-normalize:${depth}`);
  floor.items = (floor.items || []).map((item, index) => {
    if (item.slot || item.kind === "heal" || item.bonus) return item;
    const loot = createLootItem(item.name || "cache token", item.kind || "trinket", rng, depth, `${depth}-old-${index}`);
    return { ...item, ...loot, id: item.id || loot.id };
  });
  floor.landmarks = (floor.landmarks || []).map((landmark) => ({
    ...landmark,
    hinted: Boolean(landmark.hinted || landmark.seen),
    claimed: Boolean(landmark.claimed)
  }));
  return floor;
}

function createLootItem(name, preferredKind, rng, depth, suffix) {
  const kind = preferredKind === "trinket" ? choice(rng, ["weapon", "armor", "charm", "heal"]) : preferredKind;
  if (kind === "heal") {
    return {
      id: `heal-${suffix}-${hashString(name)}`,
      name: `${sentenceCase(name)} Tonic`,
      kind: "heal",
      slot: null,
      power: 6 + depth * 2 + Math.floor(rng() * 6),
      bonus: {}
    };
  }
  const slot = kind === "weapon" ? "weapon" : kind === "armor" ? "armor" : "charm";
  const stat = slot === "weapon" ? "might" : slot === "armor" ? "guard" : "focus";
  const bonus = { [stat]: 1 + Math.floor(depth / 3) + Math.floor(rng() * 2) };
  return {
    id: `${slot}-${suffix}-${hashString(name)}`,
    name: sentenceCase(name),
    kind,
    slot,
    power: 0,
    bonus
  };
}

function stripWorldItem(item) {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    slot: item.slot || null,
    power: item.power || 0,
    bonus: item.bonus || {},
    quest: Boolean(item.quest)
  };
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
