const MODULE_ID = "imagine-interface";
const LEGACY_MODULE_ID = "wow-extra-spellbars";
const TOTAL_BARS = 10;
const SLOTS_PER_BAR = 10;
const PAGES_PER_BAR = 5;
const DEFAULT_DATA = {
  slots: {},
  pages: {},
  locks: {},
  positions: {},
  setupButton: null,
  activeBars: {},
  orientations: {},
  keybinds: {},
  keybindsInitialized: false,
  audioEnabled: true,
  audioPreviousVolumes: null
};

let setupMode = false;
let settingsMenuOpen = false;
let settingsPanelIndex = null;
let keybindCapture = null;
let activeDrag = null;

let draggedSlotKey = null;
let slotDropHandled = false;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showLabels", {
    name: "II.Settings.ShowLabels.Name",
    hint: "II.Settings.ShowLabels.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: renderAll
  });

  game.settings.register(MODULE_ID, "data", {
    scope: "client",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_DATA)
  });

  game.settings.register(LEGACY_MODULE_ID, "showLabels", {
    scope: "client", config: false, type: Boolean, default: false
  });
  game.settings.register(LEGACY_MODULE_ID, "data", {
    scope: "client", config: false, type: Object, default: foundry.utils.deepClone(DEFAULT_DATA)
  });
});

Hooks.once("ready", async () => {
  document.body.classList.add("ii-v13", "ii-hide-core-hotbar");
  await migrateLegacySettings();
  migrateOldCoreData();
  renderAll();
  applyAudioStateFromData();
  hideOriginalAudioControls();
  window.setTimeout(renderChatDiceControls, 100);
  window.setTimeout(renderChatDiceControls, 500);
  window.setTimeout(renderChatDiceControls, 1500);
  startChatDiceObserver();
});

Hooks.on("renderHotbar", () => {
  document.body.classList.add("ii-hide-core-hotbar");
  window.setTimeout(() => {
    renderAll();
    hideOriginalAudioControls();
  }, 50);
});
Hooks.on("controlToken", () => renderAll());
Hooks.on("updateActor", () => renderAll());
Hooks.on("renderChatLog", () => window.setTimeout(renderChatDiceControls, 50));
Hooks.on("renderSidebarTab", () => window.setTimeout(renderChatDiceControls, 50));
Hooks.on("activateSidebarTab", () => window.setTimeout(renderChatDiceControls, 50));
Hooks.on("collapseSidebar", () => window.setTimeout(renderChatDiceControls, 50));

function renderAll() {
  renderActionBars();
  renderSetupButton();
  hideOriginalAudioControls();
}

async function migrateLegacySettings() {
  try {
    const current = game.settings.get(MODULE_ID, "data");
    const legacy = game.settings.get(LEGACY_MODULE_ID, "data");
    const currentEmpty = !current?.slots || Object.keys(current.slots).length === 0;
    const legacyHasData = legacy?.slots && Object.keys(legacy.slots).length > 0;
    if (currentEmpty && legacyHasData) {
      await game.settings.set(MODULE_ID, "data", normalizeData(legacy));
      const oldShowLabels = game.settings.get(LEGACY_MODULE_ID, "showLabels");
      await game.settings.set(MODULE_ID, "showLabels", Boolean(oldShowLabels));
      ui.notifications?.info(game.i18n.localize("II.Notifications.Migrated"));
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Legacy settings migration skipped`, error);
  }
}

// В старых сборках нижняя панель была стандартным хотбаром Foundry.
// В новой архитектуре все 4 панели — наши одинаковые компоненты.
// Если пользователь уже добавил макросы в стандартный хотбар, пробуем скопировать
// текущие 50 слотов Foundry в нижнюю панель (bar 0), не затирая уже сохранённые слоты.
async function migrateOldCoreData() {
  try {
    const flag = game.settings.get(MODULE_ID, "migratedCoreHotbarV050");
    if (flag) return;
  } catch (_) {
    game.settings.register(MODULE_ID, "migratedCoreHotbarV050", {
      scope: "client", config: false, type: Boolean, default: false
    });
  }

  try {
    const data = getData();
    let changed = false;
    const hotbar = game.user?.hotbar ?? {};
    for (let page = 1; page <= PAGES_PER_BAR; page++) {
      for (let s = 0; s < SLOTS_PER_BAR; s++) {
        const foundrySlot = ((page - 1) * SLOTS_PER_BAR) + s + 1;
        const macroId = hotbar[foundrySlot];
        if (!macroId) continue;
        const macro = game.macros?.get?.(macroId);
        if (!macro) continue;
        const key = slotKey(0, page, s);
        if (data.slots[key]) continue;
        data.slots[key] = serializeMacro(macro);
        changed = true;
      }
    }
    if (changed) await setData(data);
    await game.settings.set(MODULE_ID, "migratedCoreHotbarV050", true);
  } catch (error) {
    console.warn(`${MODULE_ID} | Core hotbar migration skipped`, error);
  }
}

function normalizeData(raw) {
  const data = foundry.utils.deepClone(raw ?? DEFAULT_DATA);
  data.slots ??= {};
  data.pages ??= {};
  data.locks ??= {};
  data.positions ??= {};
  data.activeBars ??= {};
  data.orientations ??= {};
  data.keybinds ??= {};
  data.audioEnabled ??= true;
  data.audioPreviousVolumes ??= null;
  if (!data.keybindsInitialized) {
    const defaults = makeDefaultKeybinds();
    data.keybinds = foundry.utils.mergeObject(defaults, data.keybinds ?? {}, { inplace: false });
    data.keybindsInitialized = true;
  }
  for (let b = 0; b < TOTAL_BARS; b++) {
    data.pages[b] ??= 1;
    data.locks[b] ??= false;
    data.activeBars[b] ??= b < 4;
    data.orientations[b] ??= "horizontal";
    data.keybinds[b] ??= {};
  }
  return data;
}

function makeDefaultKeybinds() {
  const keybinds = {};
  for (let b = 0; b < TOTAL_BARS; b++) keybinds[b] = {};
  const defaults = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  for (let s = 0; s < SLOTS_PER_BAR; s++) keybinds[0][s] = defaults[s];
  return keybinds;
}

function getSlotKeybind(data, barIndex, slotIndex) {
  const value = data?.keybinds?.[barIndex]?.[slotIndex];
  return typeof value === "string" && value.length ? value : "";
}

function getEventKeyCombo(event) {
  if (!event) return "";
  const ignored = new Set(["Shift", "Control", "Alt", "Meta", "Dead", "Unidentified"]);
  if (ignored.has(event.key)) return "";
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  let key = event.key ?? "";
  if (event.code?.startsWith?.("Digit")) key = event.code.slice(5);
  else if (event.code?.startsWith?.("Numpad") && /^Numpad\d$/.test(event.code)) key = event.code.slice(6);
  else if (key === " ") key = "Space";
  else if (key === "Escape") key = "Esc";
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

function isTypingIntoTextField() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function getSlotKeyByBarAndSlot(barIndex, slotIndex) {
  const data = getData();
  const page = Number(data.pages?.[barIndex] ?? 1);
  return slotKey(barIndex, page, slotIndex);
}

function getData() {
  return normalizeData(game.settings.get(MODULE_ID, "data"));
}

async function setData(data) {
  await game.settings.set(MODULE_ID, "data", normalizeData(data));
}

function selectedActor() {
  const token = canvas?.tokens?.controlled?.[0];
  return token?.actor ?? game.user.character ?? null;
}

function slotKey(barIndex, page, slotIndex) {
  return `bar-${barIndex}-page-${page}-slot-${slotIndex}`;
}

function parseBarFromKey(key) {
  const match = /^bar-(\d+)-page-\d+-slot-\d+$/.exec(key ?? "");
  return match ? Number(match[1]) : null;
}

async function resolveSavedDoc(slotData) {
  if (!slotData) return null;
  if (slotData.uuid) {
    const doc = await fromUuid(slotData.uuid);
    if (doc) return doc;
  }
  if (slotData.kind === "macro" && slotData.macroId) return game.macros?.get?.(slotData.macroId) ?? null;
  const actor = selectedActor();
  if (slotData.kind === "item" && actor && slotData.itemId) return actor.items.get(slotData.itemId) ?? null;
  return null;
}

function renderActionBars(options = {}) {
  if (!game?.user || !document.body) return;
  document.getElementById("ii-action-bars")?.remove();
  document.body.classList.add("ii-hide-core-hotbar");
  document.body.classList.toggle("ii-setup-mode", setupMode);

  const showLabels = Boolean(game.settings.get(MODULE_ID, "showLabels"));
  const data = getData();
  const container = document.createElement("div");
  container.id = "ii-action-bars";

  const defaultPositions = calculateDefaultBarPositions();

  // Рендерим сверху вниз: 4, 3, 2, 1. Нижняя панель имеет индекс 0.
  for (let b = TOTAL_BARS - 1; b >= 0; b--) {
    if (data.activeBars?.[b] === false) continue;
    const page = Number(data.pages?.[b] ?? 1);
    const locked = Boolean(data.locks?.[b]);
    const flashPage = options.flashBar === b;

    const bar = document.createElement("div");
    bar.classList.add("ii-bar");
    if (locked) bar.classList.add("ii-locked");
    const orientation = getBarOrientation(data, b);
    bar.classList.add(`ii-${orientation}`);
    if (setupMode) bar.classList.add("ii-layout-mode");
    bar.dataset.bar = String(b);
    bar.dataset.orientation = orientation;

    const pos = data.positions?.[b] ?? defaultPositions[b];
    bar.style.left = `${pos.left}px`;
    bar.style.top = `${pos.top}px`;
    bar.addEventListener("mousedown", event => onBarMouseDown(event, b));
    bar.addEventListener("wheel", event => onBarWheel(event, b));

    bar.appendChild(makeLockButton(locked, () => toggleLock(b)));

    const slotsWrap = document.createElement("div");
    slotsWrap.classList.add("ii-slots");

    for (let s = 0; s < SLOTS_PER_BAR; s++) {
      const key = slotKey(b, page, s);
      const saved = data.slots?.[key];
      const slot = document.createElement("div");
      slot.classList.add("ii-slot");
      if (locked) slot.classList.add("ii-slot-locked");
      slot.dataset.key = key;
      slot.title = saved?.name ?? game.i18n.localize("II.Tooltip.Empty");
      slot.draggable = false;

      const img = document.createElement("img");
      img.src = saved?.img || `modules/${MODULE_ID}/assets/empty-slot.webp`;
      img.alt = saved?.name ?? "";
      img.draggable = false;
      slot.appendChild(img);

      const keybindValue = getSlotKeybind(data, b, s);
      if (keybindValue) {
        const keybind = document.createElement("span");
        keybind.classList.add("ii-keybind");
        keybind.textContent = keybindValue;
        slot.appendChild(keybind);
      }

      if (showLabels && saved?.name) {
        const label = document.createElement("span");
        label.classList.add("ii-label");
        label.textContent = saved.name;
        slot.appendChild(label);
      }

      slot.addEventListener("mousedown", event => prepareSlotDrag(event, slot, key));
      slot.addEventListener("dragstart", event => onDragStartSlot(event, key));
      slot.addEventListener("dragend", event => onDragEndSlot(event, key));
      slot.addEventListener("dragover", event => { if (!isBarLocked(b)) event.preventDefault(); });
      slot.addEventListener("drop", event => onDropSlot(event, key));
      slot.addEventListener("click", event => onClickSlot(event, key));
      slotsWrap.appendChild(slot);
    }

    bar.append(slotsWrap, makePager(page, () => changePage(b, -1), () => changePage(b, 1), flashPage));
    container.appendChild(bar);
  }

  document.body.appendChild(container);
}

function getBarOrientation(data, barIndex) {
  const value = data?.orientations?.[barIndex];
  return ["horizontal", "vertical-up", "vertical-down"].includes(value) ? value : "horizontal";
}

function barDimensions(orientation = "horizontal") {
  const slot = 48;
  const gap = 6;
  const longSide = (slot * 12) + (gap * 12) + 14;
  const shortSide = 64;
  return orientation === "horizontal"
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function clampPositionToViewport(pos, width = 64, height = 64) {
  return {
    left: Math.max(0, Math.min(window.innerWidth - width, Math.round(pos.left))),
    top: Math.max(0, Math.min(window.innerHeight - height, Math.round(pos.top)))
  };
}

function snapPositionToViewportAndBars(pos, width = 64, height = 64, currentElement = null) {
  const edgeThreshold = 18;
  const panelThreshold = 40;
  const gap = 8;
  const currentBar = currentElement?.closest?.(".ii-bar") ?? currentElement;
  const otherBars = Array.from(document.querySelectorAll("#ii-action-bars .ii-bar"))
    .filter(bar => {
      if (bar === currentBar) return false;
      if (!bar.isConnected) return false;
      if (!bar.getClientRects?.().length) return false;
      const style = window.getComputedStyle(bar);
      return style.display !== "none" && style.visibility !== "hidden";
    });

  let next = clampPositionToViewport(pos, width, height);

  const rectFrom = p => ({
    left: p.left,
    top: p.top,
    right: p.left + width,
    bottom: p.top + height,
    width,
    height,
    centerX: p.left + width / 2,
    centerY: p.top + height / 2
  });

  const rangesOverlap = (a1, a2, b1, b2, tolerance = 0) =>
    Math.max(a1, b1) <= Math.min(a2, b2) + tolerance;

  const rectsOverlap = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  const nearest = (value, candidates, threshold) => {
    let best = value;
    let bestDistance = threshold + 0.001;
    for (const target of candidates) {
      const distance = Math.abs(value - target);
      if (distance <= threshold && distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }
    return best;
  };

  // 1. Магнит к краям экрана.
  next.left = nearest(next.left, [0, window.innerWidth - width], edgeThreshold);
  next.top = nearest(next.top, [0, window.innerHeight - height], edgeThreshold);
  next = clampPositionToViewport(next, width, height);

  // 2. Магнит к другим панелям: выравнивание и соседство с зазором.
  let xCandidates = [];
  let yCandidates = [];
  const currentRect = rectFrom(next);

  for (const bar of otherBars) {
    const r = bar.getBoundingClientRect();
    const horizontalOverlap = rangesOverlap(currentRect.left, currentRect.right, r.left, r.right, panelThreshold);
    const verticalOverlap = rangesOverlap(currentRect.top, currentRect.bottom, r.top, r.bottom, panelThreshold);

    // Если панели стоят рядом по вертикали, выравниваем их по X.
    if (verticalOverlap) {
      xCandidates.push(
        r.left,
        r.right - width,
        r.left + r.width / 2 - width / 2,
        r.left - width - gap,
        r.right + gap
      );
    }

    // Если панели стоят рядом по горизонтали, выравниваем их по Y.
    if (horizontalOverlap) {
      yCandidates.push(
        r.top,
        r.bottom - height,
        r.top + r.height / 2 - height / 2,
        r.top - height - gap,
        r.bottom + gap
      );
    }
  }

  if (xCandidates.length) next.left = nearest(next.left, xCandidates, panelThreshold);
  if (yCandidates.length) next.top = nearest(next.top, yCandidates, panelThreshold);
  next = clampPositionToViewport(next, width, height);

  // 3. Запрет перекрытия: если панель заведена поверх другой, выталкиваем её
  // на ближайшую свободную сторону с тем же небольшим зазором.
  next = resolvePanelCollisions(next, width, height, otherBars, gap);
  return clampPositionToViewport(next, width, height);
}

function resolvePanelCollisions(pos, width, height, otherBars, gap = 8) {
  const rectFrom = p => ({
    left: p.left,
    top: p.top,
    right: p.left + width,
    bottom: p.top + height,
    width,
    height,
    centerX: p.left + width / 2,
    centerY: p.top + height / 2
  });
  const rectsOverlap = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const distanceSq = (a, b) => ((a.left - b.left) ** 2) + ((a.top - b.top) ** 2);
  const clamp = p => clampPositionToViewport(p, width, height);
  const makeOtherRects = () => otherBars.map(bar => {
    const r = bar.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      centerX: r.left + r.width / 2,
      centerY: r.top + r.height / 2
    };
  });

  const otherRects = makeOtherRects();
  const overlapsAny = p => {
    const r = rectFrom(p);
    return otherRects.some(o => rectsOverlap(r, o));
  };

  let next = clamp(pos);
  if (!overlapsAny(next)) return next;

  // Если панель отпущена поверх другой, ищем ближайшую свободную сторону.
  // Сохраняем визуальный смысл движения: сначала пробуем поставить рядом с
  // пересекаемой панелью, затем проверяем все остальные панели и границы экрана.
  for (let pass = 0; pass < 12 && overlapsAny(next); pass++) {
    const current = rectFrom(next);
    const blocker = otherRects.find(o => rectsOverlap(current, o));
    if (!blocker) break;

    const xAlignments = [
      next.left,
      blocker.left,
      blocker.right - width,
      blocker.centerX - width / 2
    ];
    const yAlignments = [
      next.top,
      blocker.top,
      blocker.bottom - height,
      blocker.centerY - height / 2
    ];

    const candidates = [];
    for (const x of xAlignments) {
      candidates.push(clamp({ left: x, top: blocker.top - height - gap }));
      candidates.push(clamp({ left: x, top: blocker.bottom + gap }));
    }
    for (const y of yAlignments) {
      candidates.push(clamp({ left: blocker.left - width - gap, top: y }));
      candidates.push(clamp({ left: blocker.right + gap, top: y }));
    }

    const free = candidates.filter(candidate => !overlapsAny(candidate));
    if (!free.length) break;

    next = free.reduce((best, candidate) =>
      distanceSq(pos, candidate) < distanceSq(pos, best) ? candidate : best,
      free[0]
    );
  }

  return clamp(next);
}

function calculateDefaultBarPositions() {
  const { width: panelWidth, height: panelHeight } = barDimensions("horizontal");
  const verticalGap = 8;
  const left = Math.round((window.innerWidth - panelWidth) / 2);
  const bottom = 16;
  const groupHeight = (panelHeight * TOTAL_BARS) + (verticalGap * (TOTAL_BARS - 1));
  const topStart = Math.round(window.innerHeight - bottom - groupHeight);
  const positions = {};
  for (let b = TOTAL_BARS - 1; b >= 0; b--) {
    const orderFromTop = (TOTAL_BARS - 1) - b;
    positions[b] = { left, top: topStart + orderFromTop * (panelHeight + verticalGap) };
  }
  return positions;
}

function renderSetupButton() {
  document.getElementById("ii-setup-button")?.remove();
  document.getElementById("ii-settings-menu")?.remove();
  const data = getData();
  const pos = data.setupButton ?? { left: 18, top: Math.round(window.innerHeight * 0.42) };
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "ii-setup-button";
  btn.classList.toggle("ii-setup-active", setupMode || settingsMenuOpen);
  btn.innerHTML = '<i class="fa-solid fa-gear"></i>';
  btn.title = game.i18n.localize("II.Tooltip.SetupMode");
  btn.style.left = `${pos.left}px`;
  btn.style.top = `${pos.top}px`;
  let moved = false;
  btn.addEventListener("mousedown", event => {
    if (!event.shiftKey || event.button !== 0) return;
    moved = false;
    startPointerDrag(event, pos, next => {
      moved = true;
      btn.style.left = `${next.left}px`;
      btn.style.top = `${next.top}px`;
      const menu = document.getElementById("ii-settings-menu");
      if (menu) positionSettingsMenu(menu, next);
    }, async next => {
      const data = getData();
      data.setupButton = next;
      await setData(data);
      renderSetupButton();
    });
  });
  btn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey || moved) return;
    settingsMenuOpen = !settingsMenuOpen;
    if (!settingsMenuOpen) settingsPanelIndex = null;
    renderSetupButton();
  });
  document.body.appendChild(btn);
  if (settingsMenuOpen) renderSettingsMenu(pos);
}

function renderSettingsMenu(buttonPos) {
  document.getElementById("ii-settings-menu")?.remove();
  if (settingsPanelIndex !== null) {
    renderPanelSettingsMenu(buttonPos, settingsPanelIndex);
    return;
  }

  const data = getData();
  const menu = document.createElement("div");
  menu.id = "ii-settings-menu";
  positionSettingsMenu(menu, buttonPos);

  const title = document.createElement("div");
  title.classList.add("ii-settings-title");
  title.textContent = "Панели действий";
  menu.appendChild(title);

  const audioRow = document.createElement("div");
  audioRow.classList.add("ii-settings-row", "ii-settings-row-audio");
  const audioEnabled = data.audioEnabled !== false;
  audioRow.innerHTML = `<span class="ii-settings-audio ${audioEnabled ? "ii-audio-on" : "ii-audio-off"}"><i class="fa-solid ${audioEnabled ? "fa-volume-high" : "fa-volume-xmark"}"></i></span><span>${game.i18n.localize("II.Settings.Audio")}</span>`;
  audioRow.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await toggleAudioEnabled();
  });
  menu.appendChild(audioRow);

  const setupRow = document.createElement("div");
  setupRow.classList.add("ii-settings-row", "ii-settings-row-setup");
  setupRow.innerHTML = `<span class="ii-settings-check ${setupMode ? "ii-checked" : ""}"></span><span>${game.i18n.localize("II.Settings.SetupMode")}</span>`;
  setupRow.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    setupMode = !setupMode;
    renderAll();
  });
  menu.appendChild(setupRow);

  for (let b = 0; b < TOTAL_BARS; b++) {
    const row = document.createElement("div");
    row.classList.add("ii-settings-row", "ii-settings-panel-row");

    const active = data.activeBars?.[b] !== false;
    const eye = document.createElement("button");
    eye.type = "button";
    eye.classList.add("ii-settings-eye");
    eye.innerHTML = `<i class="fa-solid ${active ? "fa-eye" : "fa-eye-slash"}"></i>`;
    eye.title = active ? "Скрыть панель" : "Показать панель";
    eye.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      const nextData = getData();
      nextData.activeBars ??= {};
      nextData.activeBars[b] = !(nextData.activeBars?.[b] !== false);
      await setData(nextData);
      renderAll();
    });

    const label = document.createElement("span");
    label.classList.add("ii-settings-panel-label");
    label.textContent = game.i18n.format("II.Settings.Panel", { number: b + 1 });

    const gear = document.createElement("button");
    gear.type = "button";
    gear.classList.add("ii-settings-gear");
    gear.innerHTML = '<i class="fa-solid fa-gear"></i>';
    gear.title = "Настройки панели";
    gear.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      settingsPanelIndex = b;
      keybindCapture = null;
      renderSetupButton();
    });

    row.append(eye, label, gear);
    menu.appendChild(row);
  }

  menu.addEventListener("click", event => event.stopPropagation());
  document.body.appendChild(menu);
}

function renderPanelSettingsMenu(buttonPos, barIndex) {
  const data = getData();
  const menu = document.createElement("div");
  menu.id = "ii-settings-menu";
  menu.classList.add("ii-panel-settings-menu");
  positionSettingsMenu(menu, buttonPos);

  const back = document.createElement("div");
  back.classList.add("ii-settings-row", "ii-settings-back");
  back.innerHTML = `<span>←</span><span>Панели действий</span>`;
  back.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    settingsPanelIndex = null;
    keybindCapture = null;
    renderSetupButton();
  });
  menu.appendChild(back);

  const title = document.createElement("div");
  title.classList.add("ii-settings-title");
  title.textContent = `${game.i18n.format("II.Settings.Panel", { number: barIndex + 1 })}: горячие клавиши`;
  menu.appendChild(title);

  for (let s = 0; s < SLOTS_PER_BAR; s++) {
    const row = document.createElement("div");
    row.classList.add("ii-settings-row", "ii-keybind-row");

    const label = document.createElement("span");
    label.classList.add("ii-keybind-row-label");
    label.textContent = `Слот ${s + 1}`;

    const bind = document.createElement("button");
    bind.type = "button";
    bind.classList.add("ii-keybind-button");
    const current = getSlotKeybind(data, barIndex, s);
    const capturing = keybindCapture?.bar === barIndex && keybindCapture?.slot === s;
    bind.textContent = capturing ? "Нажмите клавишу…" : (current || "Не назначено");
    if (capturing) bind.classList.add("ii-keybind-capturing");
    bind.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      keybindCapture = { bar: barIndex, slot: s };
      renderSetupButton();
    });

    const clear = document.createElement("button");
    clear.type = "button";
    clear.classList.add("ii-keybind-clear");
    clear.textContent = "×";
    clear.title = "Очистить";
    clear.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      await setKeybind(barIndex, s, "");
    });

    row.append(label, bind, clear);
    menu.appendChild(row);
  }

  const hint = document.createElement("div");
  hint.classList.add("ii-settings-hint");
  hint.textContent = "Нажми на поле клавиши, затем нажми нужную клавишу или сочетание. Esc — отмена.";
  menu.appendChild(hint);

  menu.addEventListener("click", event => event.stopPropagation());
  document.body.appendChild(menu);
}

async function setKeybind(barIndex, slotIndex, combo) {
  const data = getData();
  data.keybinds ??= {};
  for (let b = 0; b < TOTAL_BARS; b++) data.keybinds[b] ??= {};

  if (combo) {
    for (let b = 0; b < TOTAL_BARS; b++) {
      for (let s = 0; s < SLOTS_PER_BAR; s++) {
        if (Number(b) === Number(barIndex) && Number(s) === Number(slotIndex)) continue;
        if (data.keybinds[b]?.[s] === combo) data.keybinds[b][s] = "";
      }
    }
  }

  data.keybinds[barIndex][slotIndex] = combo || "";
  data.keybindsInitialized = true;
  await setData(data);
  keybindCapture = null;
  renderAll();
}

function positionSettingsMenu(menu, buttonPos) {
  const left = Math.max(8, Math.min(window.innerWidth - 220, Math.round(buttonPos.left + 42)));
  const top = Math.max(8, Math.min(window.innerHeight - 190, Math.round(buttonPos.top)));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function makeLockButton(locked, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("ii-lock");
  if (locked) btn.classList.add("ii-lock-closed");
  btn.innerHTML = locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>';
  btn.title = locked ? game.i18n.localize("II.Tooltip.Unlock") : game.i18n.localize("II.Tooltip.Lock");
  btn.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); onClick(); });
  return btn;
}

function makePager(page, upFn, downFn, flash = false) {
  const pager = document.createElement("div");
  pager.classList.add("ii-pager");
  const up = document.createElement("button");
  up.type = "button";
  up.classList.add("ii-page-button", "ii-page-up");
  up.innerHTML = "▲";
  up.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); upFn(); });

  const current = document.createElement("div");
  current.classList.add("ii-page-number");
  if (flash) current.classList.add("ii-page-flash");
  current.textContent = String(page);

  const down = document.createElement("button");
  down.type = "button";
  down.classList.add("ii-page-button", "ii-page-down");
  down.innerHTML = "▼";
  down.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); downFn(); });
  pager.append(up, current, down);
  return pager;
}

async function toggleLock(barIndex) {
  const data = getData();
  data.locks[barIndex] = !Boolean(data.locks?.[barIndex]);
  await setData(data);
  renderActionBars();
}

async function changePage(barIndex, direction) {
  const data = getData();
  const current = Number(data.pages?.[barIndex] ?? 1);
  let next = current + direction;
  if (next < 1) next = PAGES_PER_BAR;
  if (next > PAGES_PER_BAR) next = 1;
  data.pages[barIndex] = next;
  await setData(data);
  renderActionBars({ flashBar: barIndex });
}

function isBarLocked(barIndex) {
  return Boolean(getData().locks?.[barIndex]);
}

function prepareSlotDrag(event, slot, key) {
  const barIndex = parseBarFromKey(key);
  const saved = getData().slots?.[key];
  slot.draggable = Boolean(saved && event.shiftKey && !isBarLocked(barIndex));
}

function onDragStartSlot(event, key) {
  const barIndex = parseBarFromKey(key);
  if (barIndex !== null && isBarLocked(barIndex)) { event.preventDefault(); return; }
  if (!event.shiftKey) { event.preventDefault(); return; }
  const saved = getData().slots?.[key];
  if (!saved) { event.preventDefault(); return; }
  draggedSlotKey = key;
  slotDropHandled = false;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify({ type: "II_SLOT", key }));
  event.currentTarget?.classList?.add("ii-dragging");
}

async function onDragEndSlot(event, key) {
  event.currentTarget?.classList?.remove("ii-dragging");
  if (event.currentTarget) event.currentTarget.draggable = false;
  if (draggedSlotKey !== key) return;
  const originalKey = draggedSlotKey;
  const shouldClear = !slotDropHandled;
  draggedSlotKey = null;
  slotDropHandled = false;
  const barIndex = parseBarFromKey(originalKey);
  if (!shouldClear || isBarLocked(barIndex)) return;
  const data = getData();
  if (!data.slots?.[originalKey]) return;
  delete data.slots[originalKey];
  await setData(data);
  renderActionBars({ flashBar: barIndex });
  ui.notifications.info(game.i18n.localize("II.Notifications.Cleared"));
}

async function onDropSlot(event, key) {
  const barIndex = parseBarFromKey(key);
  if (isBarLocked(barIndex)) return;
  event.preventDefault();
  event.stopPropagation();
  slotDropHandled = true;

  let dropData;
  try { dropData = JSON.parse(event.dataTransfer.getData("text/plain")); }
  catch (_) { ui.notifications.warn(game.i18n.localize("II.Notifications.DropSupported")); return; }

  if (dropData.type === "II_SLOT") { await moveSlot(dropData.key, key); return; }

  const saved = await serializeDropData(dropData);
  if (!saved) { ui.notifications.warn(game.i18n.localize("II.Notifications.DropSupported")); return; }
  const data = getData();
  data.slots[key] = saved;
  await setData(data);
  renderActionBars();
}

async function moveSlot(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const fromBar = parseBarFromKey(fromKey);
  const toBar = parseBarFromKey(toKey);
  if (isBarLocked(fromBar) || isBarLocked(toBar)) return;
  const data = getData();
  const saved = data.slots?.[fromKey];
  if (!saved) return;
  data.slots[toKey] = saved;
  delete data.slots[fromKey];
  await setData(data);
  renderActionBars();
}

async function serializeDropData(dropData) {
  const type = dropData.type ?? dropData.documentName;
  if (type === "Macro" || dropData.uuid?.includes("Macro.")) {
    const macro = await resolveMacroFromDropData(dropData);
    return macro ? serializeMacro(macro) : null;
  }
  if (type === "Item" || dropData.uuid?.includes(".Item.") || dropData.documentName === "Item") {
    const item = await resolveItemFromDropData(dropData);
    return item ? serializeItem(item) : null;
  }
  return null;
}

function serializeMacro(macro) {
  return { kind: "macro", uuid: macro.uuid, macroId: macro.id, name: macro.name, img: macro.img || "icons/svg/dice-target.svg" };
}

function serializeItem(item) {
  return { kind: "item", uuid: item.uuid, itemId: item.id, actorId: item.actor?.id ?? null, name: item.name, img: item.img, type: item.type };
}

async function resolveMacroFromDropData(dropData) {
  if (dropData.uuid) {
    const doc = await fromUuid(dropData.uuid);
    if (doc?.documentName === "Macro") return doc;
  }
  if (dropData.id) return game.macros?.get?.(dropData.id) ?? null;
  return null;
}

async function resolveItemFromDropData(dropData) {
  if (dropData.uuid) {
    const doc = await fromUuid(dropData.uuid);
    if (doc?.documentName === "Item") return doc;
  }
  const actor = selectedActor();
  if (actor && dropData.id) return actor.items.get(dropData.id) ?? null;
  return null;
}

async function onClickSlot(event, key) {
  event.preventDefault();
  if (setupMode) return;
  const saved = getData().slots?.[key];
  if (!saved) return;
  const doc = await resolveSavedDoc(saved);
  if (!doc) { ui.notifications.warn(game.i18n.localize("II.Notifications.ItemNotFound")); return; }
  try {
    if (doc.documentName === "Macro" && typeof doc.execute === "function") await doc.execute();
    else if (doc.documentName === "Item" && typeof doc.use === "function") await doc.use({}, { event });
    else doc.sheet?.render(true);
  } catch (error) {
    console.error(`${MODULE_ID} | Ошибка при использовании элемента панели действий`, error);
    ui.notifications.error(error.message ?? String(error));
  }
}

function onBarMouseDown(event, barIndex) {
  if (!setupMode || event.button !== 0) return;
  if (event.target.closest(".ii-slot, .ii-lock, .ii-pager, button")) return;
  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const start = { left: rect.left, top: rect.top };
  startPointerDrag(event, start, next => {
    bar.style.left = `${next.left}px`;
    bar.style.top = `${next.top}px`;
  }, async next => {
    const data = getData();
    data.positions ??= {};
    const rectNow = bar.getBoundingClientRect();
    data.positions[barIndex] = snapPositionToViewportAndBars(next, rectNow.width, rectNow.height, bar);
    await setData(data);
    renderActionBars();
  }, { width: rect.width, height: rect.height, snapElement: bar });
}

async function onBarWheel(event, barIndex) {
  if (!setupMode) return;
  if (event.target.closest(".ii-slot, .ii-lock, .ii-pager, button")) return;
  event.preventDefault();
  event.stopPropagation();

  const data = getData();
  const current = getBarOrientation(data, barIndex);
  const next = event.deltaY < 0
    ? (current === "vertical-down" ? "horizontal" : "vertical-up")
    : (current === "vertical-up" ? "horizontal" : "vertical-down");

  if (next === current) return;

  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const dims = barDimensions(next);
  const pos = clampPositionToViewport({ left: center.x - dims.width / 2, top: center.y - dims.height / 2 }, dims.width, dims.height);

  data.orientations ??= {};
  data.positions ??= {};
  data.orientations[barIndex] = next;
  data.positions[barIndex] = pos;
  await setData(data);
  renderActionBars({ flashBar: barIndex });
}

function startPointerDrag(event, start, onMove, onEnd, bounds = { width: 24, height: 24 }) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const width = Number(bounds.width ?? 24);
  const height = Number(bounds.height ?? 24);
  const snapElement = bounds.snapElement ?? null;
  const clampOrSnap = next => {
    const rounded = { left: Math.round(next.left), top: Math.round(next.top) };
    return snapElement
      ? snapPositionToViewportAndBars(rounded, width, height, snapElement)
      : clampPositionToViewport(rounded, width, height);
  };
  const move = ev => {
    const next = clampOrSnap({ left: start.left + (ev.clientX - startX), top: start.top + (ev.clientY - startY) });
    onMove(next);
    activeDrag = next;
  };
  const up = async ev => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    const next = activeDrag ?? clampOrSnap(start);
    activeDrag = null;
    await onEnd(next);
  };
  activeDrag = clampOrSnap(start);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
}


window.addEventListener("keydown", async event => {
  if (!game?.ready) return;

  if (keybindCapture) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      keybindCapture = null;
      renderSetupButton();
      return;
    }
    const combo = getEventKeyCombo(event);
    if (!combo) return;
    await setKeybind(keybindCapture.bar, keybindCapture.slot, combo);
    return;
  }

  if (event.repeat || setupMode || settingsMenuOpen || isTypingIntoTextField()) return;
  const combo = getEventKeyCombo(event);
  if (!combo) return;

  const data = getData();
  for (let b = 0; b < TOTAL_BARS; b++) {
    if (data.activeBars?.[b] === false) continue;
    for (let s = 0; s < SLOTS_PER_BAR; s++) {
      if (getSlotKeybind(data, b, s) !== combo) continue;
      const key = getSlotKeyByBarAndSlot(b, s);
      const saved = data.slots?.[key];
      if (!saved) return;
      event.preventDefault();
      event.stopPropagation();
      await onClickSlot(event, key);
      return;
    }
  }
}, true);

window.addEventListener("resize", () => {
  if (game?.ready) renderAll();
});

window.addEventListener("mousedown", event => {
  if (!settingsMenuOpen) return;
  if (event.target.closest?.("#ii-settings-menu, #ii-setup-button")) return;
  settingsMenuOpen = false;
  settingsPanelIndex = null;
  keybindCapture = null;
  renderSetupButton();
}, true);


const CHAT_DICE = [4, 6, 8, 12, 20, 100];
let chatDiceState = { die: null, count: 0, mod: 0, mode: null };
let chatDiceHistory = [];
const CHAT_DICE_HISTORY_LIMIT = 20;
let chatDiceObserverStarted = false;

function startChatDiceObserver() {
  if (chatDiceObserverStarted) return;
  chatDiceObserverStarted = true;
  const observer = new MutationObserver(() => {
    if (!document.getElementById('ii-chat-dice')) window.setTimeout(renderChatDiceControls, 25);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function renderChatDiceControls() {
  const textarea = getChatTextarea();
  if (!textarea) return;

  let panel = document.getElementById('ii-chat-dice');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ii-chat-dice';

    const diceRow = document.createElement('div');
    diceRow.classList.add('ii-chat-dice-row', 'ii-chat-dice-row-dice');
    for (const die of CHAT_DICE) diceRow.appendChild(makeChatDieButton(die));

    const controlRow = document.createElement('div');
    controlRow.classList.add('ii-chat-dice-row', 'ii-chat-dice-row-controls');
    controlRow.append(
      makeChatControlButton('−', 'ii-chat-minus', () => changeChatModifier(-1)),
      makeChatValueBox(),
      makeChatControlButton('+', 'ii-chat-plus', () => changeChatModifier(1)),
      makeChatControlButton(game.i18n.localize('II.Chat.Advantage'), 'ii-chat-advantage', () => setChatAdvantage('kh')),
      makeChatControlButton(game.i18n.localize('II.Chat.Disadvantage'), 'ii-chat-disadvantage', () => setChatAdvantage('kl')),
      makeChatControlButton('↶', 'ii-chat-undo', undoChatDiceChange, game.i18n.localize('II.Chat.Undo')),
      makeChatControlButton(game.i18n.localize('II.Chat.Roll'), 'ii-chat-roll', rollChatFormula)
    );

    panel.append(diceRow, controlRow);
  }

  // Безопасный режим: не меняем структуру и поведение родного ChatLog.
  // Просто ставим нашу панель сразу после стандартного поля ввода.
  if (textarea.nextElementSibling !== panel) textarea.insertAdjacentElement('afterend', panel);
  textarea.classList.add('ii-chat-controller-textarea');
  syncChatDiceControls();
}

function makeChatDieButton(die) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('ii-chat-die', `ii-chat-d${die}`);
  btn.dataset.die = String(die);
  btn.dataset.iiTooltip = `d${die}`;
  btn.setAttribute('aria-label', `d${die}`);
  btn.innerHTML = `<img class="ii-die-icon" src="modules/${MODULE_ID}/assets/icons/dice/d${die}.svg" alt="" draggable="false">`;
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    chooseChatDie(die);
  });
  return btn;
}

function makeChatControlButton(label, cls, onClick, title = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('ii-chat-control', cls);
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return btn;
}

function makeChatValueBox() {
  const box = document.createElement('div');
  box.classList.add('ii-chat-mod-value');
  box.textContent = String(chatDiceState.mod ?? 0);
  return box;
}

function getChatForm() {
  return document.querySelector('#chat-form, form#chat-form');
}

function getChatTextarea() {
  return document.querySelector(
    '#chat-message, textarea#chat-message, textarea[name="message"], #chat-form textarea, #chat textarea, #chat-controls textarea, textarea'
  );
}

function getChatHost(textarea) {
  if (!textarea) return null;
  return textarea.closest('#chat-form, form, #chat-controls, .chat-form, .chat-input, .chat-controls')
    ?? textarea.parentElement;
}

function chooseChatDie(die) {
  pushChatDiceHistory();
  if (chatDiceState.die === die) chatDiceState.count = Math.max(1, Number(chatDiceState.count ?? 0) + 1);
  else {
    chatDiceState.die = die;
    chatDiceState.count = 1;
    chatDiceState.mode = null;
  }
  writeChatFormula();
}

function changeChatModifier(delta) {
  pushChatDiceHistory();
  chatDiceState.mod = Number(chatDiceState.mod ?? 0) + delta;
  writeChatFormula();
}

function setChatAdvantage(mode) {
  if (!chatDiceState.die) return;
  pushChatDiceHistory();
  chatDiceState.mode = mode;
  chatDiceState.count = 2;
  writeChatFormula();
}

function buildChatFormula() {
  const die = chatDiceState.die;
  const mod = Number(chatDiceState.mod ?? 0);
  if (!die && mod === 0) return '';
  if (!die) return `/r ${mod}`;
  const count = Math.max(1, Number(chatDiceState.count ?? 1));
  const suffix = chatDiceState.mode ? chatDiceState.mode : '';
  let formula = `${count}d${die}${suffix}`;
  if (mod > 0) formula += `+${mod}`;
  if (mod < 0) formula += `${mod}`;
  return `/r ${formula}`;
}

function writeChatFormula() {
  const textarea = getChatTextarea();
  if (!textarea) return;
  textarea.value = buildChatFormula();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  syncChatDiceControls();
}

function syncChatDiceControls() {
  const root = document.getElementById('ii-chat-dice');
  if (!root) return;
  root.querySelectorAll('.ii-chat-die').forEach(btn => {
    btn.classList.toggle('ii-chat-active', Number(btn.dataset.die) === Number(chatDiceState.die));
  });
  root.querySelector('.ii-chat-advantage')?.classList.toggle('ii-chat-active', chatDiceState.mode === 'kh');
  root.querySelector('.ii-chat-disadvantage')?.classList.toggle('ii-chat-active', chatDiceState.mode === 'kl');
  const value = root.querySelector('.ii-chat-mod-value');
  if (value) value.textContent = String(chatDiceState.mod ?? 0);
  const undo = root.querySelector('.ii-chat-undo');
  if (undo) undo.classList.toggle('ii-chat-disabled', chatDiceHistory.length === 0);
}

function cloneChatDiceState() {
  return {
    die: chatDiceState.die ?? null,
    count: Number(chatDiceState.count ?? 0),
    mod: Number(chatDiceState.mod ?? 0),
    mode: chatDiceState.mode ?? null
  };
}

function pushChatDiceHistory() {
  chatDiceHistory.push(cloneChatDiceState());
  if (chatDiceHistory.length > CHAT_DICE_HISTORY_LIMIT) chatDiceHistory.shift();
}

function undoChatDiceChange() {
  const previous = chatDiceHistory.pop();
  if (!previous) {
    syncChatDiceControls();
    return;
  }
  chatDiceState = previous;
  writeChatFormula();
}

async function rollChatFormula() {
  const textarea = getChatTextarea();
  if (!textarea) return;
  if (!textarea.value.trim()) writeChatFormula();
  const message = textarea.value.trim();
  if (!message) return;

  try {
    // Используем родной обработчик чата Foundry, не отправляем submit формы и не двигаем ChatLog.
    if (ui?.chat && typeof ui.chat.processMessage === 'function') {
      await ui.chat.processMessage(message);
      textarea.value = '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      resetChatDiceState();
      return;
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | ui.chat.processMessage failed, falling back to native Enter`, error);
  }

  // Запасной вариант: имитируем Enter в самом поле, но не трогаем контейнер чата.
  textarea.focus();
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
}

function resetChatDiceState() {
  chatDiceState = { die: null, count: 0, mod: 0, mode: null };
  chatDiceHistory = [];
  syncChatDiceControls();
}


function hideOriginalAudioControls() {
  document.getElementById("ii-audio-slot")?.remove();

  const selectors = [
    '#hotbar .bar-controls .fa-volume-high',
    '#hotbar .bar-controls .fa-volume-up',
    '#hotbar .bar-controls .fa-volume',
    '#hotbar .bar-controls .fa-volume-low',
    '#hotbar .bar-controls .fa-volume-off',
    '#hotbar .bar-controls .fa-volume-xmark'
  ];

  for (const selector of selectors) {
    const icon = document.querySelector(selector);
    const control = icon?.closest?.('button, a, li, div');
    if (control) control.style.display = 'none';
  }
}

const AUDIO_SETTING_KEYS = [
  "globalAmbientVolume",
  "globalPlaylistVolume",
  "globalInterfaceVolume"
];

function getExistingAudioSettings() {
  return AUDIO_SETTING_KEYS.filter(key => game.settings.settings.has(`core.${key}`));
}

function readAudioVolumes() {
  const volumes = {};
  for (const key of getExistingAudioSettings()) {
    try { volumes[key] = Number(game.settings.get("core", key)); }
    catch (_) { /* ignore unknown setting */ }
  }
  return volumes;
}

async function writeAudioVolumes(volumes) {
  for (const [key, value] of Object.entries(volumes ?? {})) {
    if (!game.settings.settings.has(`core.${key}`)) continue;
    try { await game.settings.set("core", key, value); }
    catch (error) { console.warn(`${MODULE_ID} | Не удалось изменить громкость ${key}`, error); }
  }
}

async function applyAudioStateFromData() {
  const data = getData();
  if (data.audioEnabled === false) {
    const zeros = Object.fromEntries(getExistingAudioSettings().map(key => [key, 0]));
    await writeAudioVolumes(zeros);
  }
}

async function toggleAudioEnabled() {
  const data = getData();
  const enabled = data.audioEnabled !== false;

  if (enabled) {
    const current = readAudioVolumes();
    data.audioPreviousVolumes = Object.keys(current).length ? current : (data.audioPreviousVolumes ?? null);
    data.audioEnabled = false;
    await setData(data);
    const zeros = Object.fromEntries(getExistingAudioSettings().map(key => [key, 0]));
    await writeAudioVolumes(zeros);
  } else {
    data.audioEnabled = true;
    const previous = data.audioPreviousVolumes ?? Object.fromEntries(getExistingAudioSettings().map(key => [key, 0.65]));
    await setData(data);
    await writeAudioVolumes(previous);
  }

  renderAll();
}
